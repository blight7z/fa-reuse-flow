from fastapi.testclient import TestClient

PASSWORD = "Demo123!"
ACCOUNTS = {
    "ESTIMATOR": "estimator@demo.local",
    "INSPECTOR": "inspector@demo.local",
    "MANAGER": "manager@demo.local",
}


def login(client: TestClient, role: str) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": ACCOUNTS[role], "password": PASSWORD},
    )
    assert response.status_code == 200, response.text


def create_case(client: TestClient, serial: str = "TEST-SERIAL-001") -> dict:
    response = client.post(
        "/api/v1/cases",
        json={
            "seller_ref": "SELLER-TEST-001",
            "seller_name": "ผู้ขายข้อมูลสังเคราะห์",
            "seller_contact": "demo@example.test",
            "parts": [
                {
                    "brand": "Mitsubishi",
                    "model": "MR-J4-70A",
                    "category": "Servo Amplifier",
                    "quantity": 1,
                    "claimed_condition": "B",
                    "serial_number": serial,
                    "notes": "ข้อมูลทดสอบ",
                }
            ],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def transition(client: TestClient, case_id: str, status: str, **fields) -> dict:
    response = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": status, **fields},
    )
    assert response.status_code == 200, response.text
    return response.json()


def advance_to_final_quote(client: TestClient, serial: str) -> dict:
    login(client, "ESTIMATOR")
    case = create_case(client, serial)
    case_id = case["id"]
    transition(client, case_id, "PRELIMINARY_QUOTED", preliminary_quote=12000)
    transition(client, case_id, "AWAITING_DELIVERY")
    transition(client, case_id, "RECEIVED")

    login(client, "INSPECTOR")
    case = transition(client, case_id, "INSPECTING")
    response = client.post(
        f"/api/v1/cases/{case_id}/inspections",
        json={
            "part_item_id": case["parts"][0]["id"],
            "grade": "B",
            "power_result": "PASS",
            "appearance_result": "PASS",
            "serial_verified": True,
            "accessories_complete": True,
            "notes": "ผ่าน checklist จากข้อมูลสังเคราะห์",
        },
    )
    assert response.status_code == 201, response.text

    login(client, "ESTIMATOR")
    return transition(client, case_id, "FINAL_QUOTED", final_quote=10500)
