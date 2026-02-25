import os
import yt_dlp
from logger import setup_logger
from config import temp_folder

logger = setup_logger(__name__)


def download_video(url: str, output_path: str = None, progress_callback=None) -> dict:
    """
    Télécharge une vidéo depuis une URL en utilisant yt-dlp.

    Args:
        url: URL de la vidéo (YouTube, etc.)
        output_path: Dossier de destination (défaut: temp_folder)
        progress_callback: Callback appelé avec (percent, speed) à chaque update

    Returns:
        dict avec file_path, title, duration
    """
    if output_path is None:
        output_path = temp_folder

    os.makedirs(output_path, exist_ok=True)

    outtmpl = os.path.join(output_path, "%(title)s.%(ext)s")

    def _progress_hook(d):
        if progress_callback is None:
            return
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            speed = d.get("speed")
            if total > 0:
                percent = round((downloaded / total) * 100, 1)
            else:
                percent = 0
            progress_callback(percent, speed)
        elif d.get("status") == "finished":
            progress_callback(100, None)

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": outtmpl,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [_progress_hook],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"Downloading video from {url}")
            info = ydl.extract_info(url, download=True)

            title = info.get("title", "unknown")
            duration = info.get("duration", 0)
            filename = ydl.prepare_filename(info)

            # Ensure .mp4 extension
            if not filename.endswith(".mp4"):
                base = os.path.splitext(filename)[0]
                filename = base + ".mp4"

            logger.info(f"Video downloaded: {filename} ({duration}s)")

            return {
                "file_path": filename,
                "title": title,
                "duration": duration,
            }

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"Download error: {e}")
        raise ValueError(f"Impossible de télécharger la vidéo: {e}")
    except Exception as e:
        logger.error(f"Unexpected error during download: {e}")
        raise ValueError(f"Erreur lors du téléchargement: {e}")
