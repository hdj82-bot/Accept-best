"""add payments table

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan", sa.String, nullable=False),
        sa.Column("months", sa.Integer, nullable=False, server_default="1"),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column("portone_payment_id", sa.String, nullable=True, unique=True),
        sa.Column(
            "status",
            sa.Enum("pending", "paid", "failed", "cancelled", name="payment_status_enum"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_payments_portone_payment_id", "payments", ["portone_payment_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_portone_payment_id", "payments")
    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS payment_status_enum")
