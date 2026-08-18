from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import CaseStatus, CheckResult, Grade


class LoginInput(BaseModel):
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=200)


class PartInput(BaseModel):
    brand: str = Field(min_length=1, max_length=120)
    model: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=120)
    quantity: int = Field(gt=0, le=100_000)
    claimed_condition: str = Field(min_length=1, max_length=160)
    serial_number: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("brand", "model", "category", "claimed_condition")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("serial_number", "notes")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class CaseCreateInput(BaseModel):
    seller_ref: str = Field(min_length=1, max_length=120)
    seller_name: str = Field(min_length=1, max_length=180)
    seller_contact: str | None = Field(default=None, max_length=240)
    parts: list[PartInput] = Field(min_length=1, max_length=500)

    @field_validator("seller_ref", "seller_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        return value.strip()


class TransitionInput(BaseModel):
    to_status: CaseStatus
    note: str | None = Field(default=None, max_length=2000)
    preliminary_quote: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    final_quote: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class InspectionInput(BaseModel):
    part_item_id: str
    grade: Grade
    power_result: CheckResult
    appearance_result: CheckResult
    serial_verified: bool
    accessories_complete: bool
    notes: str | None = Field(default=None, max_length=2000)


class ImportCommitInput(BaseModel):
    seller_name: str = Field(min_length=1, max_length=180)
    seller_contact: str | None = Field(default=None, max_length=240)


class CaseQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
