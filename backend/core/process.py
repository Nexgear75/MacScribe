import asyncio
from core.MediaProcessor import MediaProcessor
from core.downloader import download_video
from core.llm import generate_stream
from websocket import task_manager
from config import llm_provider, llm_model, temp_folder
from logger import setup_logger
import os

logger = setup_logger(__name__)


def is_url(path: str) -> bool:
    """Vérifie si le chemin est une URL."""
    return path.startswith("http://") or path.startswith("https://")


def create_course_prompt(transcription: str) -> str:
    """Crée le prompt pour la génération d'un cours structuré sans numérotation."""
    return f"""Tu es un ingénieur pédagogique expert. Ton objectif est de transformer une transcription brute en un cours académique structuré, clair et professionnel.

Transcription à traiter :
{transcription}

Directives strictes de rédaction :
1. Filtrage du contenu : Identifie et ignore tous les passages qui n'ont aucun rapport avec le sujet pédagogique (bavardages, remarques administratives, bruits parasites, digressions personnelles).
2. Structure des titres : Utilise des titres et sous-titres Markdown (## et ###). Ne mets JAMAIS de numérotation devant les titres (pas de "1.", "I.", "A.", etc.).
3. Interactions : Si une question d'élève est pertinente pour la compréhension du sujet, inclus-la explicitement suivie de la réponse détaillée du professeur.
4. Contenu : Développe les concepts, explique les termes techniques et donne des exemples concrets mentionnés dans le texte.
5. Style : Professionnel et didactique. N'utilise aucun emoji.
6. Conclusion : Termine obligatoirement par une section intitulée "Points importants à retenir".

Génère le cours structuré maintenant :"""


def create_summary_prompt(transcription: str) -> str:
    """Crée le prompt pour la génération d'un résumé synthétique."""
    return f"""Tu es un expert en synthèse d'informations. Ton rôle est de rédiger un résumé percutant et fidèle à partir de la transcription fournie.

Transcription à traiter :
{transcription}

Directives de rédaction :
1. Titre : Donne un titre principal unique et explicite au résumé (sans numéro).
2. Points clés : Utilise une liste à puces pour énumérer les idées essentielles et les conclusions majeures de la transcription.
3. Synthèse : Rédige une conclusion synthétique qui reprend l'aboutissement de la réflexion ou du cours.
4. Contraintes de forme : Format Markdown pur. N'utilise aucun emoji. Ne numérote pas les sections.
5. Filtrage : Ne retiens que l'essentiel, élimine les redondances et le contenu non informatif.

Génère le résumé maintenant :"""


async def process_file_task(
    task_id: str, action: str, file_path: str, output_format: str, output_path: str,
    websocket=None
):
    """
    Traite un fichier avec suivi de progression en temps réel via WebSocket.
    Gère les fichiers locaux (audio/vidéo) et les URLs (téléchargement + choix utilisateur).
    """
    try:
        # ----- Détection URL vs fichier local -----
        if is_url(file_path):
            await _process_url(task_id, file_path, websocket)
            return

        # ----- Flux fichier local (existant) -----
        media = MediaProcessor(file_path)
        file_type = media.detect_file_type()

        if file_type == "error":
            await task_manager.set_error(task_id, "Format de fichier non supporté")
            return

        # Définir les tâches selon le type de fichier
        if file_type == "video":
            task_names = [
                "Extraction de l'audio",
                "Normalisation audio",
                "Transcription",
                "Génération du contenu",
                "Export",
            ]
        else:  # audio
            task_names = [
                "Normalisation audio",
                "Transcription",
                "Génération du contenu",
                "Export",
            ]

        task_manager.initialize_tasks(task_id, task_names)
        await asyncio.sleep(0.3)

        current_task = 0

        # ----- Extraction audio (si vidéo locale) -----
        if file_type == "video":
            await task_manager.start_task(task_id, current_task)
            media.extract_audio()
            await task_manager.complete_task(task_id, current_task)
            current_task += 1

        # ----- Pipeline commune : normalisation → transcription → génération → export -----
        await _run_pipeline(task_id, media, action, file_path, output_format, output_path, current_task)

    except Exception as e:
        logger.error(f"Error in process_file_task: {e}")
        await task_manager.set_error(task_id, str(e))
        raise


async def _process_url(task_id: str, url: str, websocket=None):
    """
    Phase 1 : Télécharger la vidéo, envoyer download_complete, attendre le choix utilisateur.
    Phase 2 : Si cours/résumé, extraire audio et lancer la pipeline.
    """
    # Phase 1 : Téléchargement
    task_names = ["Téléchargement de la vidéo"]
    task_manager.initialize_tasks(task_id, task_names)
    await asyncio.sleep(0.3)

    await task_manager.start_task(task_id, 0)

    # Télécharger dans un thread pour ne pas bloquer l'event loop
    import threading
    download_result = None
    download_error = None
    download_done = threading.Event()
    loop = asyncio.get_event_loop()

    def on_download_progress(percent, speed):
        """Callback appelé depuis le thread de download."""
        asyncio.run_coroutine_threadsafe(
            task_manager.update_download_progress(task_id, 0, percent, speed),
            loop,
        )

    def download_worker():
        nonlocal download_result, download_error
        try:
            download_result = download_video(url, progress_callback=on_download_progress)
            download_done.set()
        except Exception as e:
            download_error = e
            download_done.set()

    thread = threading.Thread(target=download_worker)
    thread.start()

    while not download_done.is_set():
        await asyncio.sleep(0.3)

    thread.join()

    if download_error:
        await task_manager.set_error(task_id, str(download_error))
        return

    await task_manager.update_progress(task_id, 0, 100)
    await task_manager.complete_task(task_id, 0)

    video_path = download_result["file_path"]
    video_title = download_result["title"]

    # Envoyer download_complete au client
    await task_manager.websocket_manager.send_message(
        task_id,
        {
            "type": "download_complete",
            "video_path": video_path,
            "title": video_title,
        },
    )

    logger.info(f"Download complete, waiting for user choice for task {task_id}")

    # Phase d'attente : recevoir le choix de l'utilisateur via WebSocket
    if websocket is None:
        logger.error("No websocket provided for URL flow")
        await task_manager.set_error(task_id, "Erreur interne: pas de connexion WebSocket")
        return

    try:
        data = await websocket.receive_json()
        logger.info(f"Received continue_action: {data}")
    except Exception as e:
        logger.error(f"Error waiting for continue_action: {e}")
        await task_manager.set_error(task_id, "Connexion perdue en attente du choix")
        return

    continue_action = data.get("continue_action") or data.get("action")
    output_format = data.get("output_format", "md")
    output_path = data.get("output_path", "")

    # Si "done", terminer avec le chemin de la vidéo
    if continue_action == "done":
        await task_manager.websocket_manager.send_message(
            task_id,
            {
                "type": "complete",
                "output_path": video_path,
            },
        )
        logger.info(f"Task {task_id} completed (download only)")
        return

    # Phase 2 : Extraction audio + pipeline
    if continue_action in ("create_course", "create_summary"):
        pipeline_task_names = [
            "Extraction de l'audio",
            "Normalisation audio",
            "Transcription",
            "Génération du contenu",
            "Export",
        ]
        task_manager.initialize_tasks(task_id, pipeline_task_names)
        await asyncio.sleep(0.3)

        media = MediaProcessor(video_path)
        current_task = 0

        # Extraction audio
        await task_manager.start_task(task_id, current_task)
        media.extract_audio()
        await task_manager.complete_task(task_id, current_task)
        current_task += 1

        await _run_pipeline(
            task_id, media, continue_action, video_path,
            output_format, output_path, current_task
        )
    else:
        await task_manager.set_error(task_id, f"Action inconnue: {continue_action}")


async def _run_pipeline(
    task_id: str, media: MediaProcessor, action: str,
    source_path: str, output_format: str, output_path: str,
    current_task: int
):
    """
    Pipeline commune : normalisation → transcription → génération LLM → export.
    """
    # ----- Normalisation -----
    await task_manager.start_task(task_id, current_task)
    media.normalize_audio()
    await task_manager.complete_task(task_id, current_task)
    current_task += 1
    await asyncio.sleep(0.2)

    # ----- Transcription -----
    await task_manager.start_task(task_id, current_task)

    import threading

    transcription_result = None
    transcription_done = threading.Event()

    def transcribe_worker():
        nonlocal transcription_result
        try:
            transcription_result = media.transcribe_audio()
            transcription_done.set()
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            transcription_done.set()
            raise

    thread = threading.Thread(target=transcribe_worker)
    thread.start()

    progress = 0
    while not transcription_done.is_set():
        await asyncio.sleep(0.5)
        progress = min(progress + 5, 95)
        await task_manager.update_progress(task_id, current_task, progress)

    thread.join()

    await task_manager.update_progress(task_id, current_task, 100)
    await task_manager.complete_task(task_id, current_task)
    current_task += 1
    await asyncio.sleep(0.2)

    # ----- Génération LLM -----
    await task_manager.start_task(task_id, current_task)

    transcription_text = transcription_result.get("text", "")
    if action == "create_course":
        prompt = create_course_prompt(transcription_text)
    else:
        prompt = create_summary_prompt(transcription_text)

    await task_manager.websocket_manager.send_message(
        task_id,
        {
            "type": "generation_start",
            "prompt": "Génération en cours avec DeepSeek...",
        },
    )

    logger.info(f"Starting LLM generation with {llm_provider}/{llm_model}")

    generated_content = ""
    token_count = 0

    for token in generate_stream(llm_provider, llm_model, prompt):
        generated_content += token
        token_count += 1

        if token_count % 3 == 0:
            await task_manager.websocket_manager.send_message(
                task_id,
                {
                    "type": "generation_token",
                    "token": token,
                    "content": generated_content,
                },
            )
            await asyncio.sleep(0.01)

    await task_manager.websocket_manager.send_message(
        task_id, {"type": "generation_content", "content": generated_content}
    )

    await task_manager.update_progress(task_id, current_task, 100)
    await task_manager.complete_task(task_id, current_task)
    current_task += 1
    await asyncio.sleep(0.2)

    # ----- Export -----
    await task_manager.start_task(task_id, current_task)

    source_filename = os.path.basename(source_path)
    source_name = os.path.splitext(source_filename)[0]

    if os.path.isdir(output_path):
        output_file = os.path.join(
            output_path, f"{source_name}_generated.{output_format}"
        )
    elif not output_path.endswith(f".{output_format}"):
        output_file = f"{output_path}.{output_format}"
    else:
        output_file = output_path

    output_dir = os.path.dirname(output_file)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(generated_content)

    logger.info(f"File saved to {output_file}")

    media.clean_temp()

    await task_manager.complete_task(task_id, current_task)
    await asyncio.sleep(1)
    await task_manager.complete_all(task_id, output_file)

    logger.info(f"Task {task_id} completed successfully")
