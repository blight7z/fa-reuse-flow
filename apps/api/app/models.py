from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .enums import CaseStatus, CheckResult, Grade, ImportStatus, Role


def uuid_str() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[Role] = mapped_column(Enum(Role, native_enum=False, length=20), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BuybackCase(Base, TimestampMixin):
    __tablename__ = "buyback_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    case_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    seller_ref: Mapped[str] = mapped_column(String(120), index=True)
    seller_name: Mapped[str] = mapped_column(String(180))
    seller_contact: Mapped[str | None] = mapped_column(String(240), nullable=True)
    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, native_enum=False, length=30), default=CaseStatus.NEW, index=True
    )
    previous_status: Mapped[CaseStatus | None] = mapped_column(
        Enum(CaseStatus, native_enum=False, length=30), nullable=True
    )
    preliminary_quote: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    final_quote: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    hold_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inspection_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    parts: Mapped[list[PartItem]] = relationship(back_populates="case", cascade="all, delete-orphan")
    inspections: Mapped[list[Inspection]] = relationship(back_populates="case", cascade="all, delete-orphan")
    attachments: Mapped[list[Attachment]] = relationship(back_populates="case", cascade="all, delete-orphan")
    status_events: Mapped[list[StatusEvent]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="StatusEvent.created_at"
    )


class PartItem(Base, TimestampMixin):
    __tablename__ = "part_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    case_id: Mapped[str] = mapped_column(ForeignKey("buyback_cases.id", ondelete="CASCADE"), index=True)
    brand: Mapped[str] = mapped_column(String(120))
    model: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(120))
    quantity: Mapped[int] = mapped_column(Integer)
    claimed_condition: Mapped[str] = mapped_column(String(160))
    serial_number: Mapped[str | None] = mapped_column(String(160), unique=True, index=True, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    case: Mapped[BuybackCase] = relationship(back_populates="parts")
    inspections: Mapped[list[Inspection]] = relationship(
        back_populates="part_item", cascade="all, delete-orphan"
    )


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    filename: Mapped[str] = mapped_column(String(240))
    status: Mapped[ImportStatus] = mapped_column(Enum(ImportStatus, native_enum=False, length=30))
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    committed_case_id: Mapped[str | None] = mapped_column(ForeignKey("buyback_cases.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    rows: Mapped[list[ImportRow]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="ImportRow.row_number"
    )


class ImportRow(Base):
    __tablename__ = "import_rows"
    __table_args__ = (UniqueConstraint("job_id", "row_number", name="uq_import_job_row"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    job_id: Mapped[str] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)
    field_errors: Mapped[dict] = mapped_column(JSON, default=dict)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=False)

    job: Mapped[ImportJob] = relationship(back_populates="rows")


class Inspection(Base):
    __tablename__ = "inspections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    case_id: Mapped[str] = mapped_column(ForeignKey("buyback_cases.id", ondelete="CASCADE"), index=True)
    part_item_id: Mapped[str] = mapped_column(ForeignKey("part_items.id", ondelete="CASCADE"), index=True)
    inspector_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    grade: Mapped[Grade] = mapped_column(Enum(Grade, native_enum=False, length=20))
    power_result: Mapped[CheckResult] = mapped_column(Enum(CheckResult, native_enum=False, length=20))
    appearance_result: Mapped[CheckResult] = mapped_column(Enum(CheckResult, native_enum=False, length=20))
    serial_verified: Mapped[bool] = mapped_column(Boolean)
    accessories_complete: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[BuybackCase] = relationship(back_populates="inspections")
    part_item: Mapped[PartItem] = relationship(back_populates="inspections")
    inspector: Mapped[User] = relationship()


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    case_id: Mapped[str] = mapped_column(ForeignKey("buyback_cases.id", ondelete="CASCADE"), index=True)
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(240))
    stored_filename: Mapped[str] = mapped_column(String(240), unique=True)
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[BuybackCase] = relationship(back_populates="attachments")


class StatusEvent(Base):
    __tablename__ = "status_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_str)
    case_id: Mapped[str] = mapped_column(ForeignKey("buyback_cases.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    from_status: Mapped[CaseStatus | None] = mapped_column(
        Enum(CaseStatus, native_enum=False, length=30), nullable=True
    )
    to_status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus, native_enum=False, length=30))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[BuybackCase] = relationship(back_populates="status_events")
    actor: Mapped[User] = relationship()
