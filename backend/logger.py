"""
Module de configuration centralisée du logging pour le backend.

Usage:
    from logger import setup_logger
    logger = setup_logger(__name__)

    logger.info("Message d'information")
    logger.error("Message d'erreur")
"""

import logging
import sys
from pathlib import Path
from typing import Optional


# Configuration par défaut
DEFAULT_LOG_LEVEL = logging.INFO
DEFAULT_LOG_FORMAT = "%(name)s | %(levelname)s | %(message)s"


def setup_logger(
    name: Optional[str] = None,
    level: int = DEFAULT_LOG_LEVEL,
    log_format: str = DEFAULT_LOG_FORMAT,
    log_to_file: bool = False,
    log_file_path: Optional[Path] = None,
) -> logging.Logger:
    """
    Configure et retourne un logger avec des handlers pour la console
    et optionnellement un fichier.

    Args:
        name: Nom du logger (utilise __name__ de préférence). Si None, retourne le logger root.
        level: Niveau de log (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Format des messages de log
        date_format: Format de la date dans les logs
        log_to_file: Si True, écrit aussi les logs dans un fichier
        log_file_path: Chemin du fichier de log (si log_to_file=True)

    Returns:
        Un logger configuré

    Example:
        # Dans vos modules:
        from logger import setup_logger
        logger = setup_logger(__name__)
        logger.info("Application démarrée")
    """

    # Créer le logger
    logger = logging.getLogger(name)

    # Éviter d'ajouter des handlers si déjà configuré
    if logger.hasHandlers():
        return logger

    logger.setLevel(level)

    # Formatter
    formatter = logging.Formatter(log_format)

    # Handler Console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Handler Fichier (optionnel)
    if log_to_file:
        if log_file_path is None:
            # Créer un dossier logs dans le backend
            backend_dir = Path(__file__).parent
            logs_dir = backend_dir / "logs"
            logs_dir.mkdir(exist_ok=True)
            log_file_path = logs_dir / "app.log"

        file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


# Logger par défaut pour une utilisation rapide
# Usage: from logger import logger
default_logger = setup_logger("backend")

# Pour maintenir la compatibilité avec le pattern demandé
logger = default_logger
