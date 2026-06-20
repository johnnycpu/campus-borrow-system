import urllib.request
import json

def search(query):
    url = f"https://api.github.com/search/code?q={query}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        res = urllib.request.urlopen(req)
        data = json.loads(res.read())
        for item in data.get('items', [])[:3]:
            print(item['html_url'])
    except Exception as e:
        print("Error:", e)

search("extension:glb size:<5000000 drone")
search("extension:glb size:<5000000 guitar")
