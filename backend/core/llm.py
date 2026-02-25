import os
import logging
from litellm import completion
from dotenv import load_dotenv
from typing import Generator

load_dotenv()


def generate_stream(
    provider: str, model_name: str, prompt: str
) -> Generator[str, None, None]:
    """
    Generate content with streaming support.
    Yields tokens one by one for real-time display.
    """
    try:
        if provider == "deepseek":
            response = completion(
                model=f"{provider}/{model_name}",
                messages=[{"role": "user", "content": prompt}],
                api_key=os.getenv("DEEPSEEK_API_KEY"),
                stream=True,  # Activer le streaming
            )

            full_content = ""
            for chunk in response:
                if chunk and hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content:
                        token = delta.content
                        full_content += token
                        yield token

            return full_content

        elif provider == "ollama":
            response = completion(
                model=f"{provider}/{model_name}",
                messages=[{"role": "user", "content": prompt}],
                api_base="http://localhost:11434",
                stream=True,
            )

            full_content = ""
            for chunk in response:
                if chunk and hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content:
                        token = delta.content
                        full_content += token
                        yield token

            return full_content

        else:
            # Pour les autres providers sans streaming spécifique
            response = completion(
                model=f"{provider}/{model_name}",
                messages=[{"role": "user", "content": prompt}],
                api_key=os.getenv(f"{provider.upper()}_API_KEY"),
            )

            content = ""
            if response and hasattr(response, "choices") and response.choices:
                content = response.choices[0].message.content
            elif isinstance(response, dict):
                choices = response.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")

            # Simuler le streaming en yieldant tout d'un coup
            yield content
            return content

    except Exception as e:
        logging.error(f"Error while trying to connect to llm: {e}")
        yield f"Error: {str(e)}"
        return ""


def generate(provider: str, model_name: str, prompt: str):
    """
    Generate course without streaming (for backward compatibility).
    """
    try:
        if provider == "deepseek":
            response = completion(
                model=f"{provider}/{model_name}",
                messages=[{"role": "user", "content": prompt}],
                api_key=os.getenv("DEEPSEEK_API_KEY"),
            )
            return response

        elif provider == "ollama":
            response = completion(
                model=f"{provider}/{model_name}",
                messages=[{"role": "user", "content": prompt}],
                api_base="http://localhost:11434",
                format="json",
            )
            return response

    except Exception as e:
        logging.error(f"Error while trying to connect to llm : {e}")
