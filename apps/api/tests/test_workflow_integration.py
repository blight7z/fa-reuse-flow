from .helpers import advance_to_final_quote, create_case, login, transition


def test_happy_path_to_paid_has_complete_audit_trail(client):
    final_case = advance_to_final_quote(client, "HAPPY-PATH-001")
    case_id = final_case["id"]

    login(client, "MANAGER")
    paid = transition(client, case_id, "PAID", note="อนุมัติข้อมูลสังเคราะห์")
    assert paid["status"] == "PAID"
    assert paid["paid_at"] is not None
    assert paid["completed_at"] is not None
    assert [event["to_status"] for event in paid["status_events"]] == [
        "NEW",
        "PRELIMINARY_QUOTED",
        "AWAITING_DELIVERY",
        "RECEIVED",
        "INSPECTING",
        "FINAL_QUOTED",
        "PAID",
    ]
    assert all(event["actor_name"] and event["created_at"] for event in paid["status_events"])


def test_final_quote_rejected_follows_return_path(client):
    final_case = advance_to_final_quote(client, "RETURN-PATH-001")
    case_id = final_case["id"]

    login(client, "ESTIMATOR")
    requested = transition(
        client,
        case_id,
        "RETURN_REQUESTED",
        note="ผู้ขายไม่ยอมรับราคาสุดท้าย",
    )
    assert requested["resolution_reason"] == "ผู้ขายไม่ยอมรับราคาสุดท้าย"

    login(client, "MANAGER")
    returned = transition(client, case_id, "RETURNED", note="ส่งคืนพร้อมเลขติดตามจำลอง")
    assert returned["status"] == "RETURNED"
    assert returned["completed_at"] is not None


def test_wrong_role_invalid_order_and_incomplete_qc_are_rejected(client):
    login(client, "ESTIMATOR")
    case = create_case(client, "GUARD-001")
    case_id = case["id"]

    invalid_order = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "PAID"},
    )
    assert invalid_order.status_code == 409

    login(client, "INSPECTOR")
    forbidden = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "PRELIMINARY_QUOTED", "preliminary_quote": 1000},
    )
    assert forbidden.status_code == 403

    login(client, "ESTIMATOR")
    transition(client, case_id, "PRELIMINARY_QUOTED", preliminary_quote=1000)
    transition(client, case_id, "AWAITING_DELIVERY")
    transition(client, case_id, "RECEIVED")
    login(client, "INSPECTOR")
    transition(client, case_id, "INSPECTING")

    login(client, "ESTIMATOR")
    incomplete = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "FINAL_QUOTED", "final_quote": 900},
    )
    assert incomplete.status_code == 409
    assert incomplete.json()["detail"]["code"] == "QC_INCOMPLETE"


def test_on_hold_requires_reason_and_manager_resume(client):
    login(client, "ESTIMATOR")
    case = create_case(client, "HOLD-001")
    case_id = case["id"]

    missing_reason = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "ON_HOLD"},
    )
    assert missing_reason.status_code == 422

    held = transition(client, case_id, "ON_HOLD", note="รอเอกสารจากผู้ขาย")
    assert held["previous_status"] == "NEW"

    resume_forbidden = client.post(
        f"/api/v1/cases/{case_id}/transition",
        json={"to_status": "NEW"},
    )
    assert resume_forbidden.status_code == 403

    login(client, "MANAGER")
    resumed = transition(client, case_id, "NEW", note="ได้รับเอกสารแล้ว")
    assert resumed["status"] == "NEW"
    assert resumed["previous_status"] is None
