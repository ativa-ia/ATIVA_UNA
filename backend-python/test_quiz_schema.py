import os
from dotenv import load_dotenv
import json
from app.services import ai_service

load_dotenv()

def test_quiz_generation():
    if not ai_service.client:
        print("Skipping test: No OpenAI client")
        return

    print("Generating quiz with new schema...")
    text = "O sol é uma estrela. A lua é um satélite natural da Terra. Marte é o planeta vermelho."
    
    try:
        json_str = ai_service.generate_quiz(text, num_questions=2)
        print(f"Raw Output: {json_str[:150]}...")
        
        data = json.loads(json_str)
        
        if "questions" not in data:
            print("FAILED: 'questions' key missing")
            return
            
        questions = data["questions"]
        if not isinstance(questions, list):
             print("FAILED: 'questions' is not a list")
             return
             
        if len(questions) == 0:
             print("FAILED: questions list is empty")
             return
             
        q1 = questions[0]
        if "question" not in q1 or "options" not in q1 or "correct" not in q1:
            print(f"FAILED: Missing keys in question object: {q1.keys()}")
            return
            
        print("SUCCESS: JSON Schema is valid!")
        print(f"Sample Question: {q1['question']}")
        print(f"Options: {q1['options']}")
        
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_quiz_generation()
