import httpx
import asyncio
import time

async def test_api():
    url = "http://localhost:8002/api/ai/chat"
    payload = {
        "documentId": "16a604a2-5859-4673-a61e-7974e824a20b",
        "message": "Hello",
        "history": []
    }
    
    print(f"Sending request to {url}...")
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except httpx.TimeoutException:
        print("❌ Request TIMED OUT after 10 seconds!")
    except Exception as e:
        print(f"❌ Request FAILED: {str(e)}")
    
    print(f"Total time: {time.time() - start_time:.2f}s")

if __name__ == "__main__":
    asyncio.run(test_api())
