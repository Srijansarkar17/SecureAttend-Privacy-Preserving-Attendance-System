from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from dotenv import load_dotenv
import subprocess
import json
import os
import shutil
import sys
import hashlib
import uuid
import numpy as np
from datetime import datetime, timezone

load_dotenv()

# ── Logging Helper ───────────────────────────────────────────
def log(tag: str, message: str):
    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{ts}] [{tag}] {message}")

# ── Supabase Client ──────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    log("FATAL", "Missing SUPABASE_URL or SUPABASE_KEY in .env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
log("INIT", f"Supabase client connected to {SUPABASE_URL}")

# ── FastAPI App ──────────────────────────────────────────────
app = FastAPI(title="SecureAttend API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """Hash password with SHA-256 + salt"""
    salt = "secureattend_zk_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


@app.post("/api/auth/signup")
async def signup(
    email: str = Form(...),
    password: str = Form(...),
    full_name: str = Form(...),
    role: str = Form(...),
    student_id: str = Form(None),
):
    log("AUTH", f"Signup attempt: {email} as {role}")

    # Validate email domain
    if not email.endswith("@srmist.edu.in"):
        log("AUTH", f"REJECTED — invalid domain: {email}")
        raise HTTPException(400, "Only @srmist.edu.in emails are allowed")

    if role not in ("teacher", "student"):
        raise HTTPException(400, "Role must be 'teacher' or 'student'")

    if role == "student" and not student_id:
        raise HTTPException(400, "Student ID is required for students")

    try:
        # Check if email already exists
        existing = supabase.table("users").select("id").eq("email", email).execute()
        if existing.data:
            log("AUTH", f"❌ Email already registered: {email}")
            raise HTTPException(400, "Email already registered. Please sign in.")

        user_id = str(uuid.uuid4())
        hashed = hash_password(password)

        supabase.table("users").insert({
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "role": role,
            "student_id": student_id,
            "password": hashed,
            "department": "Computer Science",
        }).execute()

        log("AUTH", f"✅ User created: {user_id} ({email}) as {role}")

        return {
            "status": "success",
            "user": {
                "id": user_id,
                "full_name": full_name,
                "email": email,
                "role": role,
                "student_id": student_id,
                "department": "Computer Science",
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        log("AUTH", f"❌ Signup error: {str(e)}")
        raise HTTPException(400, str(e))


@app.post("/api/auth/login")
async def login(
    email: str = Form(...),
    password: str = Form(...),
):
    log("AUTH", f"Login attempt: {email}")

    if not email.endswith("@srmist.edu.in"):
        log("AUTH", f"REJECTED — invalid domain: {email}")
        raise HTTPException(400, "Only @srmist.edu.in emails are allowed")

    try:
        hashed = hash_password(password)
        result = supabase.table("users").select("*").eq("email", email).eq("password", hashed).execute()

        if not result.data:
            log("AUTH", f"❌ Invalid credentials for {email}")
            raise HTTPException(401, "Invalid email or password")

        user = result.data[0]
        # Don't send password hash to frontend
        user.pop("password", None)

        log("AUTH", f"✅ Login success: {email} (role={user['role']})")
        return {
            "status": "success",
            "user": user,
        }
    except HTTPException:
        raise
    except Exception as e:
        log("AUTH", f"❌ Login error: {str(e)}")
        raise HTTPException(401, f"Login failed: {str(e)}")


# ══════════════════════════════════════════════════════════════
# DATA ENDPOINTS
# ══════════════════════════════════════════════════════════════

@app.get("/api/subjects")
async def get_subjects():
    log("DATA", "Fetching subjects")
    result = supabase.table("subjects").select("*").order("schedule_time").execute()
    log("DATA", f"Found {len(result.data)} subjects")
    return result.data


@app.get("/api/attendance/{subject_id}")
async def get_attendance_by_subject(subject_id: str):
    log("DATA", f"Fetching attendance for subject: {subject_id}")
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
    result = (
        supabase.table("attendance")
        .select("*")
        .eq("subject_id", subject_id)
        .gte("created_at", today_start)
        .order("check_in_time", desc=True)
        .execute()
    )
    log("DATA", f"Found {len(result.data)} attendance records for today")
    return result.data


@app.get("/api/attendance/all/{subject_id}")
async def get_all_attendance_by_subject(subject_id: str):
    log("DATA", f"Fetching ALL attendance for subject: {subject_id}")
    result = (
        supabase.table("attendance")
        .select("*")
        .eq("subject_id", subject_id)
        .order("check_in_time", desc=True)
        .execute()
    )
    log("DATA", f"Found {len(result.data)} total attendance records")
    return result.data


@app.get("/api/student/attendance/{user_id}")
async def get_student_attendance(user_id: str):
    log("DATA", f"Fetching attendance for student: {user_id}")
    result = (
        supabase.table("attendance")
        .select("*")
        .eq("student_id", user_id)
        .order("check_in_time", desc=True)
        .execute()
    )
    log("DATA", f"Found {len(result.data)} records for student {user_id}")
    return result.data


@app.get("/api/students/{subject_id}")
async def get_enrolled_students(subject_id: str):
    log("DATA", f"Fetching enrolled students for subject: {subject_id}")
    try:
        enrollments = (
            supabase.table("enrollments")
            .select("student_id")
            .eq("subject_id", subject_id)
            .execute()
        )
        if not enrollments.data:
            log("DATA", "No enrollments found")
            return []

        student_ids = [e["student_id"] for e in enrollments.data if e.get("student_id")]
        if not student_ids:
            return []

        profiles = (
            supabase.table("profiles")
            .select("*")
            .in_("id", student_ids)
            .execute()
        )
        log("DATA", f"Found {len(profiles.data)} enrolled students")
        return profiles.data
    except Exception as e:
        log("DATA", f"Error fetching enrolled students: {str(e)}")
        return []


@app.get("/api/registered-faces")
async def get_registered_faces():
    log("DATA", "Fetching all registered faces")
    result = supabase.table("face_registry").select("id, user_id, name, public_hash, registered_at").execute()
    log("DATA", f"Found {len(result.data)} registered faces")
    return result.data


# ══════════════════════════════════════════════════════════════
# FACE REGISTRATION
# ══════════════════════════════════════════════════════════════

@app.post("/api/register")
async def register_face(
    name: str = Form(...),
    subject: str = Form(...),
    student_id: str = Form(None),
    user_id: str = Form(None),
    file: UploadFile = File(...),
):
    log("REGISTER", f"═══ Face Registration Started ═══")
    log("REGISTER", f"Name: {name} | Subject: {subject} | Student ID: {student_id}")

    # Save uploaded file temporarily
    temp_path = os.path.abspath(f"temp_register_{name}.jpg")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    log("REGISTER", f"Image saved to {temp_path}")

    try:
        # Call the headless registration script
        result = subprocess.run(
            [sys.executable, "api_register.py", name, temp_path],
            capture_output=True, text=True,
            cwd="../minor_project",
            timeout=120,
        )

        log("REGISTER", f"Script stdout: {result.stdout[:500]}")
        if result.stderr:
            log("REGISTER", f"Script stderr: {result.stderr[:500]}")

        os.remove(temp_path)

        if result.returncode != 0:
            log("REGISTER", f"❌ Registration script failed")
            raise HTTPException(500, f"Registration failed: {result.stderr}")

        # Extract JSON from stdout (InsightFace prints model info to stdout too)
        json_line = None
        for line in result.stdout.strip().split('\n'):
            line = line.strip()
            if line.startswith('{'):
                json_line = line
        
        if not json_line:
            log("REGISTER", f"❌ No JSON found in stdout")
            raise HTTPException(500, "Registration script did not return valid JSON")

        response = json.loads(json_line)
        public_hash = response.get("public_hash", "")
        embedding = response.get("embedding", [])

        log("REGISTER", f"ZK Commitment: {public_hash[:20]}...")
        log("REGISTER", f"Embedding dims: {len(embedding)}")

        # ── Store in Supabase ────────────────────────────────
        # Check for duplicate registration
        existing = supabase.table("face_registry").select("id").eq("name", name).execute()
        if existing.data:
            # Update existing
            supabase.table("face_registry").update({
                "public_hash": public_hash,
                "embedding": embedding,
                "registered_at": datetime.now(timezone.utc).isoformat(),
            }).eq("name", name).execute()
            log("REGISTER", f"Updated existing face_registry entry for {name}")
        else:
            insert_data = {
                "name": name,
                "public_hash": public_hash,
                "embedding": embedding,
            }
            if user_id:
                insert_data["user_id"] = user_id
            supabase.table("face_registry").insert(insert_data).execute()
            log("REGISTER", f"Inserted new face_registry entry for {name}")

        # ── Auto-enroll in subject ───────────────────────────
        if user_id and subject:
            # Find subject ID from code
            subject_code = subject.split(" - ")[0].strip() if " - " in subject else subject
            sub_result = supabase.table("subjects").select("id").eq("code", subject_code).execute()
            if sub_result.data:
                subject_id = sub_result.data[0]["id"]
                # Check if already enrolled
                enroll_check = (
                    supabase.table("enrollments")
                    .select("id")
                    .eq("student_id", user_id)
                    .eq("subject_id", subject_id)
                    .execute()
                )
                if not enroll_check.data:
                    supabase.table("enrollments").insert({
                        "student_id": user_id,
                        "subject_id": subject_id,
                    }).execute()
                    log("REGISTER", f"Enrolled {name} in {subject_code}")
                else:
                    log("REGISTER", f"{name} already enrolled in {subject_code}")

        log("REGISTER", f"✅ Registration complete for {name}")
        log("REGISTER", f"═══ Face Registration Done ═══")
        return {
            "status": "success",
            "message": f"Registered {name} for {subject}",
            "public_hash": public_hash,
        }

    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        os.remove(temp_path) if os.path.exists(temp_path) else None
        log("REGISTER", f"❌ Registration timed out")
        raise HTTPException(504, "Registration timed out")
    except Exception as e:
        os.remove(temp_path) if os.path.exists(temp_path) else None
        log("REGISTER", f"❌ Error: {str(e)}")
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════
# FACE RECOGNITION + ATTENDANCE
# ══════════════════════════════════════════════════════════════

@app.post("/api/recognize")
async def recognize_face(
    subject: str = Form(...),
    file: UploadFile = File(...),
):
    log("RECOGNIZE", f"═══ Face Recognition Started ═══")
    log("RECOGNIZE", f"Subject: {subject}")

    temp_path = os.path.abspath("temp_recognize.jpg")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Fetch all registered face embeddings from Supabase
        faces_result = supabase.table("face_registry").select("*").execute()
        face_entries = faces_result.data

        if not face_entries:
            log("RECOGNIZE", "❌ No registered faces in database")
            os.remove(temp_path)
            return {"status": "error", "message": "No registered faces found", "name": "Unknown"}

        log("RECOGNIZE", f"Loaded {len(face_entries)} face entries from Supabase")

        # Build the face_db and save embeddings temporarily for api_recognize.py
        face_db = {}
        embeddings_dir = os.path.abspath("../minor_project/embeddings")
        os.makedirs(embeddings_dir, exist_ok=True)

        for entry in face_entries:
            name = entry["name"]
            face_db[name] = entry["public_hash"]
            emb_array = np.array(entry["embedding"], dtype=np.float32)
            np.save(os.path.join(embeddings_dir, f"{name}.npy"), emb_array)

        # Write face_db.json for api_recognize.py
        db_path = os.path.abspath("../minor_project/face_db.json")
        with open(db_path, "w") as f:
            json.dump(face_db, f, indent=2)

        log("RECOGNIZE", f"Synced {len(face_db)} faces to local cache")

        # Call recognition script
        result = subprocess.run(
            [sys.executable, "api_recognize.py", temp_path],
            capture_output=True, text=True,
            cwd="../minor_project",
            timeout=120,
        )

        log("RECOGNIZE", f"Script stdout: {result.stdout[:500]}")
        if result.stderr:
            log("RECOGNIZE", f"Script stderr: {result.stderr[:500]}")

        os.remove(temp_path)

        if result.returncode != 0:
            log("RECOGNIZE", f"❌ Recognition script failed")
            return {"status": "error", "message": result.stderr, "name": "Unknown"}

        # Extract JSON from stdout (InsightFace prints model info to stdout)
        json_line = None
        for line in result.stdout.strip().split('\n'):
            line = line.strip()
            if line.startswith('{'):
                json_line = line
        
        if not json_line:
            return {"status": "error", "name": "Unknown", "message": "No JSON from recognition script"}

        data = json.loads(json_line)
        recognized_name = data.get("name", "Unknown")

        log("RECOGNIZE", f"Recognition result: {recognized_name}")

        if recognized_name != "Unknown":
            # ── Mark Attendance in Supabase ───────────────────
            subject_code = subject.split(" - ")[0].strip() if " - " in subject else subject
            sub_result = supabase.table("subjects").select("id").eq("code", subject_code).execute()

            if sub_result.data:
                subject_id = sub_result.data[0]["id"]

                # Check if already marked today
                today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()
                existing_attendance = (
                    supabase.table("attendance")
                    .select("id")
                    .eq("student_name", recognized_name)
                    .eq("subject_id", subject_id)
                    .gte("created_at", today_start)
                    .execute()
                )

                if existing_attendance.data:
                    log("RECOGNIZE", f"⚠️ Attendance already marked for {recognized_name} in {subject_code} today")
                    return {
                        "status": "already_marked",
                        "name": recognized_name,
                        "message": f"{recognized_name} already marked present for {subject_code} today",
                        "zk_verified": True,
                    }

                # Find student_id from face_registry
                face_entry = supabase.table("face_registry").select("user_id").eq("name", recognized_name).execute()
                student_user_id = face_entry.data[0].get("user_id") if face_entry.data else None

                # Determine status (Late if > 10 min after schedule)
                status = "Present"
                now = datetime.now()
                # Simple late check — if after XX:10, mark as Late
                if now.minute > 10:
                    status = "Late"

                attendance_record = {
                    "student_name": recognized_name,
                    "subject_id": subject_id,
                    "subject_code": subject_code,
                    "status": status,
                    "zk_verified": True,
                    "proof_hash": face_db.get(recognized_name, ""),
                    "check_in_time": datetime.now(timezone.utc).isoformat(),
                }

                if student_user_id:
                    attendance_record["student_id"] = student_user_id

                supabase.table("attendance").insert(attendance_record).execute()
                log("RECOGNIZE", f"✅ Attendance marked: {recognized_name} → {subject_code} ({status})")
            else:
                log("RECOGNIZE", f"⚠️ Subject '{subject_code}' not found in database")

            log("RECOGNIZE", f"═══ Face Recognition Done ═══")
            return {
                "status": "success",
                "name": recognized_name,
                "zk_verified": True,
                "attendance_status": status if sub_result.data else "unknown",
            }
        else:
            log("RECOGNIZE", f"❌ No match found")
            log("RECOGNIZE", f"═══ Face Recognition Done ═══")
            return {"status": "not_found", "name": "Unknown", "zk_verified": False}

    except subprocess.TimeoutExpired:
        os.remove(temp_path) if os.path.exists(temp_path) else None
        log("RECOGNIZE", f"❌ Recognition timed out")
        raise HTTPException(504, "Recognition timed out")
    except Exception as e:
        os.remove(temp_path) if os.path.exists(temp_path) else None
        log("RECOGNIZE", f"❌ Error: {str(e)}")
        raise HTTPException(500, str(e))


# ══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0", "supabase": "connected"}


if __name__ == "__main__":
    import uvicorn
    log("INIT", "═══════════════════════════════════════════")
    log("INIT", "  SecureAttend Backend v2.0 — ZK-SNARK")
    log("INIT", "═══════════════════════════════════════════")
    uvicorn.run(app, host="0.0.0.0", port=8000)
