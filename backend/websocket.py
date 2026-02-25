"""
Module de gestion WebSocket pour le backend.
Gère les connexions, les tâches en mémoire et le broadcast des progressions.

Usage:
    from websocket import WebSocketManager, TaskManager
    
    # Dans l'endpoint WebSocket
    await websocket_manager.connect(websocket, task_id)
    
    # Pendant le traitement
    await task_manager.update_progress(task_id, task_index, progress)
"""

import asyncio
import uuid
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum
from fastapi import WebSocket
from logger import setup_logger

logger = setup_logger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class Task:
    id: int
    name: str
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0  # 0-100
    message: str = ""


@dataclass
class TaskState:
    task_id: str
    file_path: str
    action: str
    output_format: str
    output_path: str
    tasks: List[Task] = field(default_factory=list)
    current_task_index: int = -1
    completed: bool = False
    error: Optional[str] = None


class WebSocketManager:
    """Gère les connexions WebSocket actives."""
    
    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, task_id: str):
        """Accepte une nouvelle connexion WebSocket."""
        await websocket.accept()
        self.connections[task_id] = websocket
        logger.info(f"WebSocket connected for task {task_id}")
    
    def disconnect(self, task_id: str):
        """Ferme une connexion WebSocket."""
        if task_id in self.connections:
            del self.connections[task_id]
            logger.info(f"WebSocket disconnected for task {task_id}")
    
    async def send_message(self, task_id: str, message: dict):
        """Envoie un message à un client spécifique."""
        if task_id in self.connections:
            try:
                await self.connections[task_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {task_id}: {e}")
    
    async def broadcast(self, message: dict):
        """Envoie un message à tous les clients connectés."""
        for task_id in list(self.connections.keys()):
            await self.send_message(task_id, message)


class TaskManager:
    """Gère les tâches en mémoire et leurs états."""
    
    def __init__(self, websocket_manager: WebSocketManager):
        self.tasks: Dict[str, TaskState] = {}
        self.websocket_manager = websocket_manager
    
    def create_task(
        self,
        file_path: str,
        action: str,
        output_format: str,
        output_path: str
    ) -> str:
        """Crée une nouvelle tâche et retourne son ID."""
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = TaskState(
            task_id=task_id,
            file_path=file_path,
            action=action,
            output_format=output_format,
            output_path=output_path
        )
        logger.info(f"Created task {task_id}")
        return task_id
    
    def get_task(self, task_id: str) -> Optional[TaskState]:
        """Récupère l'état d'une tâche."""
        return self.tasks.get(task_id)
    
    def initialize_tasks(self, task_id: str, task_names: List[str]):
        """Initialise la liste des sous-tâches."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        task_state.tasks = [
            Task(id=i, name=name)
            for i, name in enumerate(task_names)
        ]
        
        # Notifier le client
        asyncio.create_task(
            self.websocket_manager.send_message(
                task_id,
                {
                    "type": "init",
                    "tasks": [
                        {
                            "id": task.id,
                            "name": task.name,
                            "status": task.status.value,
                            "progress": task.progress
                        }
                        for task in task_state.tasks
                    ]
                }
            )
        )
    
    async def start_task(self, task_id: str, task_index: int):
        """Marque une tâche comme en cours."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        task_state.current_task_index = task_index
        
        if 0 <= task_index < len(task_state.tasks):
            task = task_state.tasks[task_index]
            task.status = TaskStatus.RUNNING
            task.progress = 0
            
            await self.websocket_manager.send_message(
                task_id,
                {
                    "type": "status",
                    "task_id": task_index,
                    "status": task.status.value
                }
            )
            logger.info(f"Task {task_id} - Started: {task.name}")
    
    async def update_progress(self, task_id: str, task_index: int, progress: int):
        """Met à jour la progression d'une tâche."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        if 0 <= task_index < len(task_state.tasks):
            task = task_state.tasks[task_index]
            task.progress = max(0, min(100, progress))
            
            await self.websocket_manager.send_message(
                task_id,
                {
                    "type": "progress",
                    "task_id": task_index,
                    "progress": task.progress
                }
            )
    
    async def update_download_progress(self, task_id: str, task_index: int, percent: float, speed: float | None):
        """Met à jour la progression d'un téléchargement avec vitesse."""
        if task_id not in self.tasks:
            return

        task_state = self.tasks[task_id]
        if 0 <= task_index < len(task_state.tasks):
            task = task_state.tasks[task_index]
            task.progress = max(0, min(100, int(percent)))

            await self.websocket_manager.send_message(
                task_id,
                {
                    "type": "progress",
                    "task_id": task_index,
                    "progress": task.progress,
                    "download_percent": percent,
                    "download_speed": speed,
                }
            )

    async def complete_task(self, task_id: str, task_index: int):
        """Marque une tâche comme terminée."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        if 0 <= task_index < len(task_state.tasks):
            task = task_state.tasks[task_index]
            task.status = TaskStatus.COMPLETED
            task.progress = 100
            
            await self.websocket_manager.send_message(
                task_id,
                {
                    "type": "status",
                    "task_id": task_index,
                    "status": task.status.value,
                    "progress": 100
                }
            )
            logger.info(f"Task {task_id} - Completed: {task.name}")
    
    async def set_error(self, task_id: str, error_message: str):
        """Marque une tâche comme en erreur."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        task_state.error = error_message
        
        if 0 <= task_state.current_task_index < len(task_state.tasks):
            task = task_state.tasks[task_state.current_task_index]
            task.status = TaskStatus.ERROR
            task.message = error_message
            
            await self.websocket_manager.send_message(
                task_id,
                {
                    "type": "error",
                    "task_id": task_state.current_task_index,
                    "message": error_message
                }
            )
        
        logger.error(f"Task {task_id} - Error: {error_message}")
    
    async def complete_all(self, task_id: str, output_path: str):
        """Marque toutes les tâches comme terminées."""
        if task_id not in self.tasks:
            return
        
        task_state = self.tasks[task_id]
        task_state.completed = True
        task_state.output_path = output_path
        
        await self.websocket_manager.send_message(
            task_id,
            {
                "type": "complete",
                "output_path": output_path
            }
        )
        logger.info(f"Task {task_id} - All completed. Output: {output_path}")
    
    def cleanup(self, task_id: str):
        """Nettoie une tâche terminée."""
        if task_id in self.tasks:
            del self.tasks[task_id]
            logger.info(f"Cleaned up task {task_id}")


# Instances globales
websocket_manager = WebSocketManager()
task_manager = TaskManager(websocket_manager)
