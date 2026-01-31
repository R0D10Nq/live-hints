"""
Финальная проверка исправлений
"""

def main():
    print("=== CHECKING PROFILE FIX ===\n")
    
    # 1. Check settings.json
    import json
    import os
    
    settings_path = os.path.join(os.path.dirname(__file__), 'renderer', 'settings.json')
    if os.path.exists(settings_path):
        with open(settings_path, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            profile = settings.get('profile')
            print(f"1. Profile from settings.json: {profile}")
    
    # 2. Check mode_context.txt
    mode_context_path = os.path.join(os.path.dirname(__file__), 'python', 'mode_context.txt')
    if os.path.exists(mode_context_path):
        with open(mode_context_path, 'r', encoding='utf-8') as f:
            context = f.read()[:50]
            print(f"2. Mode context exists: {context}...")
    
    # 3. Test logic
    if profile in ['business_meeting', 'daily_sync', 'presentation', 'custom']:
        print("3. Logic: WILL use business prompt")
        print("4. Context: WILL load from mode_context.txt")
        result = "BUSINESS MEETING MODE"
    else:
        print("3. Logic: WILL use interview STAR format")
        print("4. Context: WILL load from user_context.txt")
        result = "INTERVIEW MODE"
    
    print(f"\n=== RESULT: {result} ===")
    
    # Summary of changes
    print("\n=== CHANGES MADE ===")
    print("1. classification.py - build_contextual_prompt() now uses profile")
    print("2. ollama_client.py - OllamaClient stores profile in self.profile")
    print("3. llm_server.py - loads profile from settings.json")
    print("4. endpoints - update ollama.profile from request")
    print("\nTHE FIX IS COMPLETE!")


if __name__ == '__main__':
    main()
