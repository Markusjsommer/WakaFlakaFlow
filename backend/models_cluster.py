"""SQLAlchemy ORM models for automated population identification.

Two tables layered on top of the shared Base (from db.py):
  * ClusteringRun - one FlowSOM+UMAP run against an FCS file in a session.
  * Population    - one identified cell population (metacluster) within a run.

Field names mirror the SLICE A contract so the API and frontend link exactly.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db import Base

# Colorblind-safe qualitative palette for default population colors.
# Paul Tol's "bright" scheme followed by the Okabe-Ito set and Tol "muted"
# extras; every entry is distinguishable under deuteranopia/protanopia and the
# first eight are ordered for maximum separation (most populations use those).
POPULATION_PALETTE = [
    "#4477AA",  # blue
    "#EE6677",  # rose
    "#228833",  # green
    "#CCBB44",  # olive-yellow
    "#66CCEE",  # cyan
    "#AA3377",  # purple
    "#E69F00",  # orange
    "#0072B2",  # deep blue
    "#009E73",  # bluish green
    "#D55E00",  # vermillion
    "#CC79A7",  # reddish purple
    "#332288",  # indigo
    "#117733",  # dark green
    "#882255",  # wine
    "#999933",  # olive
    "#56B4E9",  # sky
]


def palette_color(index: int) -> str:
    """Default population color for the ``index``-th population (wraps the palette)."""
    return POPULATION_PALETTE[int(index) % len(POPULATION_PALETTE)]


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ClusteringRun(Base):
    __tablename__ = "clustering_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id"), nullable=False
    )
    job_id: Mapped[str] = mapped_column(String, nullable=False)
    fcs_file_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    params: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    n_populations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    umap: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    populations: Mapped[list["Population"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class Population(Base):
    __tablename__ = "populations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    clustering_run_id: Mapped[str] = mapped_column(
        String, ForeignKey("clustering_runs.id"), nullable=False
    )
    parent_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    metacluster_id: Mapped[int] = mapped_column(Integer, nullable=False)
    cell_count: Mapped[int] = mapped_column(Integer, nullable=False)
    percentage_of_parent: Mapped[float] = mapped_column(Float, nullable=False)
    median_expression: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    color: Mapped[str] = mapped_column(String, nullable=False, default="#4DBBD5")
    is_manual_gate: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    run: Mapped["ClusteringRun"] = relationship(back_populates="populations")
