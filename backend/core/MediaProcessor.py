import mlx_whisper
import os
import shutil
from logger import setup_logger
from pydub import AudioSegment, effects
from config import whisper_model, temp_folder, NORMALIZED_AUDIO_PATH

logger = setup_logger(__name__)


class MediaProcessor:
    def __init__(self, file_path) -> None:
        self.file_path = file_path

    # ----- File ------ #

    def clean_temp(self):
        for filename in os.listdir(temp_folder):
            file_path = os.path.join(temp_folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                    logger.info(f"File {file_path.split('/')[-1]} successfully removed")
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
                    logger.info(
                        f"Folder {file_path.split('/')[-1]} successfully removed"
                    )
            except Exception as e:
                logger.error(f"Failed to delete {file_path}. Reasons : {e}")

    def detect_file_type(self):
        video_extension = [
            "mp4",
            "mkv",
            "mov",
            "avi",
            "3gp",
            "m4v",
            "webm",
            "wmv",
            "mpg",
            "flv",
        ]

        audio_extension = [
            "mp3",
            "m4a",
            "wav",
            "aac",
            "mid",
            "ogg",
            "flac",
            "amr",
            "aiff",
        ]

        first_split = self.file_path.split("/")  # Extracting file + extension
        second_split = first_split[-1].split(".")  # Extracting extension (ex : mp3)
        file_format = second_split[-1]
        if file_format in video_extension:
            logger.info(f"File format detected : {file_format} is a video file")
            return "video"
        elif file_format in audio_extension:
            logger.info(f"File format detected : {file_format} is an audio file")
            return "audio"
        else:
            logger.error(f"{first_split[-1]} is not a video or audio file")
            return "error"

    # ----- Video ----- #

    def extract_audio(self, video_path: str = None) -> str:
        """
        Extrait l'audio d'un fichier vidéo et l'exporte en WAV dans le dossier temp.

        Args:
            video_path: Chemin vers le fichier vidéo (défaut: self.file_path)

        Returns:
            str: Chemin du fichier audio extrait
        """
        if video_path is None:
            video_path = self.file_path

        logger.info(f"Extracting audio from {video_path}")
        audio = AudioSegment.from_file(video_path)

        output_path = os.path.join(temp_folder, "extracted_audio.wav")
        audio.export(output_path, format="wav")

        logger.info(f"Audio extracted to {output_path}")

        # Update file_path so normalize_audio() uses the extracted audio
        self.file_path = output_path
        return output_path

    # ----- Audio ------ #

    def normalize_audio(self):
        """
        Normalize the audio to prepare it for translation

        Args:
            file_path (str): Path to the audio file

        Returns:
            Void: create temporary file audio.mp3
        """
        # ----- Loading audio file ----- #
        logger.info(f"Loading audio file from {self.file_path}")
        rawsound = AudioSegment.from_file(self.file_path)

        # ----- Normalize audio ----- #
        logger.info("Starting normalizing audio")
        normalized_sound = effects.normalize(rawsound)
        logger.info("Audio normalized successfully")

        normalized_sound.export(NORMALIZED_AUDIO_PATH, format="wav")

    def get_audio_duration(self):
        """
        Get the duration of an audio file in seconds using PyDub

        Args:
            file_path (str): Path to the audio file

        Returns:
            float or None: Duration is seconds, or None if an error occurs
        """

        try:
            # ----- Loading audio file ----- #
            audio = AudioSegment.from_file(self.file_path)

            # ----- Get duration in milliseconds and convert to seconds ------ #
            duration_seconds = len(audio) / 1000.0
            return duration_seconds

        except Exception as e:
            logger.error(f"Error processing audio file: {e}")
            return None

    def transcribe_audio(self):
        """
        Transcribe audio to text using mlx-whisper with Metal GPU acceleration

        Args:
            normalized_audio_path: Path to the normalized audio file
            whisper_model: Model name (e.g., 'tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3')

        Returns:
            dict: Transcription result with text, segments, and language info
        """
        repo_id = f"mlx-community/whisper-{whisper_model}"

        result = mlx_whisper.transcribe(NORMALIZED_AUDIO_PATH, path_or_hf_repo=repo_id)

        logger.info(
            f"Transcription completed. Language: {result.get('language')}, Duration: {result.get('duration', 0):.2f}s"
        )

        return result

    # ----- Text ----- #


if __name__ == "__main__":
    media = MediaProcessor("/Users/alexfougeroux/Downloads/reinforcement2.m4a")
    media.normalize_audio()
    transcribe = media.transcribe_audio()
    media.clean_temp()
    print(transcribe)
