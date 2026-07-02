import json
import ipaddress
import socket
from pathlib import Path

from flask import Flask, abort, jsonify, render_template, request


BASE_DIR = Path(__file__).resolve().parent
QUESTION_DIR = BASE_DIR / "题库"
DATA_DIR = BASE_DIR / "data"
FAVORITES_FILE = DATA_DIR / "favorites.json"
PROGRESS_FILE = DATA_DIR / "progress.json"
STATS_FILE = DATA_DIR / "stats.json"
HIGHLIGHT_RULES_FILE = BASE_DIR / "static" / "highlight_rules.json"

app = Flask(__name__)


def list_question_banks():
    return sorted(QUESTION_DIR.glob("*.json"), key=lambda path: path.name)


def get_bank_path(filename):
    for path in list_question_banks():
        if path.name == filename:
            return path
    abort(404, description="题库不存在")


def load_bank(filename):
    with get_bank_path(filename).open("r", encoding="utf-8") as file:
        return json.load(file)


def load_favorites():
    if not FAVORITES_FILE.exists():
        return []

    try:
        with FAVORITES_FILE.open("r", encoding="utf-8") as file:
            favorites = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []
    return favorites if isinstance(favorites, list) else []


def save_favorites(favorites):
    DATA_DIR.mkdir(exist_ok=True)
    temp_file = FAVORITES_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(favorites, file, ensure_ascii=False, indent=2)
    temp_file.replace(FAVORITES_FILE)


def load_progress():
    if not PROGRESS_FILE.exists():
        return {}

    try:
        with PROGRESS_FILE.open("r", encoding="utf-8") as file:
            progress = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    return progress if isinstance(progress, dict) else {}


def save_progress(progress):
    DATA_DIR.mkdir(exist_ok=True)
    temp_file = PROGRESS_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(progress, file, ensure_ascii=False, indent=2)
    temp_file.replace(PROGRESS_FILE)


def load_stats():
    if not STATS_FILE.exists():
        return {}

    try:
        with STATS_FILE.open("r", encoding="utf-8") as file:
            stats = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}
    return stats if isinstance(stats, dict) else {}


def save_stats(stats):
    DATA_DIR.mkdir(exist_ok=True)
    temp_file = STATS_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(stats, file, ensure_ascii=False, indent=2)
    temp_file.replace(STATS_FILE)


def load_highlight_rules():
    if not HIGHLIGHT_RULES_FILE.exists():
        return []

    try:
        with HIGHLIGHT_RULES_FILE.open("r", encoding="utf-8-sig") as file:
            rules = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []
    return rules if isinstance(rules, list) else []


def save_highlight_rules(rules):
    HIGHLIGHT_RULES_FILE.parent.mkdir(exist_ok=True)
    temp_file = HIGHLIGHT_RULES_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(rules, file, ensure_ascii=False, indent=2)
    temp_file.replace(HIGHLIGHT_RULES_FILE)


def local_ips():
    addresses = set()

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            addresses.add(info[4][0])
    except OSError:
        pass

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            addresses.add(sock.getsockname()[0])
    except OSError:
        pass

    usable = []
    for address in sorted(addresses):
        ip = ipaddress.ip_address(address)
        if not ip.is_loopback and not ip.is_link_local:
            usable.append(address)
    return usable or ["127.0.0.1"]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/banks")
def banks():
    items = []
    for path in list_question_banks():
        try:
            with path.open("r", encoding="utf-8") as file:
                title = json.load(file).get("title", path.stem)
        except (OSError, json.JSONDecodeError):
            title = path.stem
        items.append({"file": path.name, "title": title})
    return jsonify(items)


@app.route("/api/banks/<path:filename>")
def bank(filename):
    return jsonify(load_bank(filename))


@app.route("/api/question")
def question():
    filename = request.args.get("bank", "")
    part = request.args.get("part", "")
    section = request.args.get("section", "")
    number = request.args.get("number", "")

    data = load_bank(filename)
    try:
        return jsonify(data[part][section][number])
    except KeyError:
        abort(404, description="题目不存在")


@app.route("/api/favorites", methods=["GET", "POST", "DELETE"])
def favorites():
    favorites_data = load_favorites()

    if request.method == "GET":
        return jsonify(favorites_data)

    if request.method == "POST":
        item = request.get_json(silent=True) or {}
        favorite_id = item.get("id")
        if not favorite_id:
            abort(400, description="收藏缺少 ID")

        favorites_data = [favorite for favorite in favorites_data if favorite.get("id") != favorite_id]
        favorites_data.insert(0, item)
        save_favorites(favorites_data)
        return jsonify(favorites_data)

    favorite_id = request.args.get("id", "")
    if not favorite_id:
        abort(400, description="删除收藏缺少 ID")

    favorites_data = [favorite for favorite in favorites_data if favorite.get("id") != favorite_id]
    save_favorites(favorites_data)
    return jsonify(favorites_data)


@app.route("/api/progress", methods=["GET", "POST"])
def progress():
    if request.method == "GET":
        return jsonify(load_progress())

    item = request.get_json(silent=True) or {}
    required = ["bankFile", "part", "section", "number"]
    if not all(item.get(key) for key in required):
        abort(400, description="进度缺少题库或题号信息")

    save_progress(item)
    return jsonify(item)


@app.route("/api/stats", methods=["GET", "POST"])
def stats():
    stats_data = load_stats()

    if request.method == "GET":
        return jsonify(stats_data)

    item = request.get_json(silent=True) or {}
    question_id = str(item.get("id", "")).strip()
    correct = item.get("correct")
    if not question_id or not isinstance(correct, bool):
        abort(400, description="统计缺少题目 ID 或对错状态")

    record = stats_data.setdefault(
        question_id,
        {
            "attempts": 0,
            "correct": 0,
            "wrong": 0,
            "lastCorrect": False,
            "updatedAt": 0,
        },
    )
    record["attempts"] = int(record.get("attempts", 0)) + 1
    if correct:
        record["correct"] = int(record.get("correct", 0)) + 1
    else:
        record["wrong"] = int(record.get("wrong", 0)) + 1
    record["lastCorrect"] = correct
    record["updatedAt"] = item.get("updatedAt", 0)
    save_stats(stats_data)
    return jsonify(stats_data)


@app.route("/api/highlight-rules", methods=["GET", "POST"])
def highlight_rules():
    rules = load_highlight_rules()

    if request.method == "GET":
        return jsonify(rules)

    item = request.get_json(silent=True) or {}
    label = str(item.get("label", "")).strip()
    keyword = str(item.get("keyword", "")).strip()
    if not label or not keyword:
        abort(400, description="高亮收集需要分类和文字")

    for rule in rules:
        if rule.get("label") == label:
            keywords = rule.setdefault("keywords", [])
            if keyword not in keywords:
                keywords.append(keyword)
            save_highlight_rules(rules)
            return jsonify(rules)

    rules.append({"label": label, "keywords": [keyword]})
    save_highlight_rules(rules)
    return jsonify(rules)


if __name__ == "__main__":
    port = 5000
    print(f"本机访问: http://127.0.0.1:{port}")
    for ip in local_ips():
        print(f"局域网访问: http://{ip}:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
