import pytesseract
from PIL import Image
import io

def test():
    print("Testing pytesseract...")
    img = Image.new('RGB', (100, 100), color=(255, 255, 255))
    try:
        text = pytesseract.image_to_string(img)
        print(f"Success! Text: '{text}'")
    except Exception as e:
        print(f"Caught Exception: {type(e).__name__}: {str(e)}")
        if "tesseract is not installed" in str(e).lower():
            print("Match! Fallback should work.")
        else:
            print("No Match! Fallback logic will fail.")

if __name__ == "__main__":
    test()
