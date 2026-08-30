"""
InfraGuard AI — Network API Router
Endpoints:
  GET /api/network
"""

from fastapi import APIRouter, Query
from services import network_service

router = APIRouter(prefix="/api", tags=["Network"])


@router.get("/network")
def get_network(
    max_nodes: int = Query(200, ge=10, le=1000, description="Max nodes to return"),
):
    """
    Return the project co-dependency network graph.
    Nodes = projects, edges = shared agency/state/cost-band relationships.
    """
    data = network_service.get_network(max_nodes=max_nodes)
    return data
