import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()

def test_api():
    print("Initializing ChatOpenAI...")
    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        model="cohere/north-mini-code:free",
        temperature=0,
        timeout=10 # set a 10s timeout
    )
    print("Sending test query to OpenRouter...")
    try:
        resp = llm.invoke("Say hello!")
        print("Response received:")
        print(resp.content)
    except Exception as e:
        print("Error encountered:", str(e))

if __name__ == "__main__":
    test_api()
