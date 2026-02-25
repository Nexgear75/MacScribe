"""
Module de configuration centralisée pour le backend.
Lit le fichier config.json à la racine du projet.

Usage:
    from config import config

    # Accès aux valeurs
    whisper_model = config.transcription.whisper_model
    provider = config.llm.provider
    temp_folder = config.paths.temp_folder
"""

import json
from pathlib import Path
from dataclasses import dataclass
from logger import setup_logger

logger = setup_logger(__name__)


@dataclass
class TranscriptionConfig:
    whisper_model: str


@dataclass
class LLMConfig:
    provider: str
    model: str


@dataclass
class PathsConfig:
    temp_folder: str
    output_folder: str


@dataclass
class Config:
    transcription: TranscriptionConfig
    llm: LLMConfig
    paths: PathsConfig


# Chemin vers le fichier config.json (racine du projet)
PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_PATH = PROJECT_ROOT / "config.json"

# Valeurs par défaut
DEFAULT_CONFIG = {
    "transcription": {"whisper_model": "large-v3-turbo"},
    "llm": {"provider": "Kimi", "model": "k2.5"},
    "paths": {"temp_folder": ".temp", "output_folder": "./output/"},
}

NORMALIZED_AUDIO_NAME = "normalized_audio.wav"


def load_config() -> Config:
    """
    Charge la configuration depuis config.json à la racine du projet.
    Crée le fichier avec les valeurs par défaut s'il n'existe pas.

    Returns:
        Objet Config avec les paramètres de l'application
    """
    if not CONFIG_PATH.exists():
        logger.info(f"Config file not found at {CONFIG_PATH}, creating default config")
        save_config(DEFAULT_CONFIG)
        config_dict = DEFAULT_CONFIG
    else:
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config_dict = json.load(f)
            logger.info(f"Config loaded from {CONFIG_PATH}")
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing config.json: {e}")
            logger.info("Using default configuration")
            config_dict = DEFAULT_CONFIG
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            config_dict = DEFAULT_CONFIG

    return Config(
        transcription=TranscriptionConfig(
            whisper_model=config_dict.get("transcription", {}).get(
                "whisper_model", DEFAULT_CONFIG["transcription"]["whisper_model"]
            )
        ),
        llm=LLMConfig(
            provider=config_dict.get("llm", {}).get(
                "provider", DEFAULT_CONFIG["llm"]["provider"]
            ),
            model=config_dict.get("llm", {}).get(
                "model", DEFAULT_CONFIG["llm"]["model"]
            ),
        ),
        paths=PathsConfig(
            temp_folder=config_dict.get("paths", {}).get(
                "temp_folder", DEFAULT_CONFIG["paths"]["temp_folder"]
            ),
            output_folder=config_dict.get("paths", {}).get(
                "output_folder", DEFAULT_CONFIG["paths"]["output_folder"]
            ),
        ),
    )


def save_config(config_dict: dict) -> None:
    """
    Sauvegarde la configuration dans config.json.

    Args:
        config_dict: Dictionnaire contenant la configuration
    """
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)
        logger.info(f"Config saved to {CONFIG_PATH}")
    except Exception as e:
        logger.error(f"Error saving config: {e}")


# Instance globale de la configuration (chargée une seule fois)
config = load_config()

# Variables individuelles pour import direct (optionnel)
whisper_model = config.transcription.whisper_model
llm_provider = config.llm.provider
llm_model = config.llm.model

# Chemins absolus résolus depuis la racine du projet
temp_folder = str(PROJECT_ROOT / config.paths.temp_folder)
output_folder = str(PROJECT_ROOT / config.paths.output_folder)

NORMALIZED_AUDIO_PATH = f"{temp_folder}/{NORMALIZED_AUDIO_NAME}"

if __name__ == "__main__":
    # Test du module
    print(f"Whisper Model: {config.transcription.whisper_model}")
    print(f"LLM Provider: {config.llm.provider}")
    print(f"LLM Model: {config.llm.model}")
    print(f"Temp Folder: {config.paths.temp_folder}")
    print(f"Output Folder: {config.paths.output_folder}")
