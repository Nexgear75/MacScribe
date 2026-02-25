from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import asyncio

from core.process import process_file_task
from websocket import websocket_manager, task_manager
from logger import setup_logger

logger = setup_logger(__name__)

app = FastAPI()

origins = ["http://localhost:5173", "localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    action: str
    file_path: str
    output_format: str
    output_path: str


# ----- ENDPOINTS -----#
@app.get("/health")
async def get_health():
    return {"message": "Online"}


@app.websocket("/ws/process")
async def websocket_process(websocket: WebSocket):
    """
    Endpoint WebSocket pour le traitement des fichiers avec suivi en temps réel.

    Flux standard (fichier local):
    1. Client envoie: {"action": "create_course|create_summary", "file_path": "...", ...}
    2. Backend traite et envoie les mises à jour de progression
    3. Backend envoie "complete" à la fin

    Flux URL (download_video):
    1. Client envoie: {"action": "download_video", "file_path": "https://..."}
    2. Backend télécharge et envoie "download_complete"
    3. Client envoie: {"continue_action": "create_course|create_summary|done", ...}
    4. Backend continue la pipeline ou termine
    """
    task_id = None

    try:
        await websocket.accept()
        logger.info("WebSocket connection accepted")

        data = await websocket.receive_json()
        logger.info(f"Received data: {data}")

        action = data["action"]
        file_path = data["file_path"]
        output_format = data.get("output_format", "")
        output_path = data.get("output_path", "")

        task_id = task_manager.create_task(
            file_path=file_path,
            action=action,
            output_format=output_format,
            output_path=output_path
        )

        websocket_manager.connections[task_id] = websocket

        await websocket.send_json({
            "type": "connected",
            "task_id": task_id
        })

        try:
            await process_file_task(
                task_id=task_id,
                action=action,
                file_path=file_path,
                output_format=output_format,
                output_path=output_path,
                websocket=websocket
            )

            await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"Error processing task {task_id}: {e}")
            await task_manager.set_error(task_id, str(e))
            await asyncio.sleep(2)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for task {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if task_id:
            await task_manager.set_error(task_id, str(e))
    finally:
        if task_id:
            websocket_manager.disconnect(task_id)
