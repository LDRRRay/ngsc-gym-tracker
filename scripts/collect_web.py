#!/usr/bin/env python3
import json
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "data" / "history.json"
TZ = ZoneInfo("Asia/Taipei")

request = urllib.request.Request(
    "https://ngsc.cyc.org.tw/api",
    data=b"",
    method="POST",
    headers={"User-Agent": "ngsc-crowd-tracker/1.0", "Accept": "application/json"},
)
with urllib.request.urlopen(request, timeout=20) as response:
    payload = json.loads(response.read().decode("utf-8"))

gym = payload.get("gym")
if not isinstance(gym, list) or len(gym) < 2:
    raise RuntimeError(f"Unexpected response: {payload}")
current, capacity = int(gym[0]), int(gym[1])
if current < 0 or capacity <= 0:
    raise RuntimeError(f"Invalid values: {current}/{capacity}")

data = json.loads(DATA.read_text(encoding="utf-8"))
observations = data.setdefault("observations", [])
observations.append({
    "observed_at": datetime.now(TZ).replace(microsecond=0).isoformat(),
    "current_people": current,
    "capacity": capacity,
})
# 約保留兩年（每天 288 筆），避免儲存庫無限膨脹。
data["observations"] = observations[-210240:]
DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Collected {current}/{capacity}")
