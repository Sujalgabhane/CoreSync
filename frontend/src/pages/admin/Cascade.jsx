import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../../api/axios';
import SlideOver from '../../components/ui/SlideOver';
import { StatusBadge, UomBadge } from '../../components/ui/Badge';
import { SkeletonDashboard } from '../../components/ui/SkeletonLoader';

const ROLE_COLORS = { admin: '#4F46E5', manager: '#7C3AED', employee: '#0EA5E9' };
const SHARED_EDGE_COLORS = ['#F59E0B', '#10B981', '#F43F5E', '#8B5CF6', '#06B6D4'];

export default function CascadeView() {
  const svgRef = useRef(null);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userGoals, setUserGoals] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    api.get('/users/org-tree')
      .then(res => setOrgData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!orgData || !svgRef.current) return;
    renderTree(orgData);
  }, [orgData]);

  function renderTree(roots) {
    const container = svgRef.current.parentElement;
    const W = container.clientWidth || 900;
    const H = 600;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H);

    // Zoom & pan
    const g = svg.append('g');
    svg.call(
      d3.zoom().scaleExtent([0.3, 2]).on('zoom', e => g.attr('transform', e.transform))
    );

    // Add arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#CBD5E1');

    // Build a single root if multiple top-level nodes
    const root = d3.hierarchy(
      roots.length === 1 ? roots[0] : { name: 'Organization', role: 'admin', children: roots }
    );

    const treeLayout = d3.tree().size([W - 80, H - 140]);
    treeLayout(root);

    // Links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical().x(d => d.x + 40).y(d => d.y + 50))
      .attr('fill', 'none')
      .attr('stroke', '#CBD5E1')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)');

    // Nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x + 40}, ${d.y + 50})`)
      .style('cursor', d => d.data.id ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (d.data.id) openPanel(d.data);
      });

    // Card background
    node.append('rect')
      .attr('x', -60)
      .attr('y', -22)
      .attr('width', 120)
      .attr('height', 44)
      .attr('rx', 8)
      .attr('fill', 'white')
      .attr('stroke', d => ROLE_COLORS[d.data.role] || '#CBD5E1')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))')
      .on('mouseover', function() { d3.select(this).attr('fill', '#F8FAFC'); })
      .on('mouseout', function() { d3.select(this).attr('fill', 'white'); });

    // Role color dot
    node.append('circle')
      .attr('cx', -48)
      .attr('cy', -8)
      .attr('r', 4)
      .attr('fill', d => ROLE_COLORS[d.data.role] || '#CBD5E1');

    // Name text
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -6)
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('fill', '#1E293B')
      .text(d => d.data.name?.split(' ')[0] || '?');

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 8)
      .attr('font-size', '9px')
      .attr('fill', '#94A3B8')
      .text(d => d.data.department || d.data.role || '');

    // Goals count badge
    node.filter(d => d.data.approved_goals_count > 0)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 19)
      .attr('font-size', '9px')
      .attr('fill', '#4F46E5')
      .attr('font-weight', '700')
      .text(d => `${d.data.approved_goals_count} goals`);
  }

  async function openPanel(userData) {
    setSelectedUser(userData);
    setPanelLoading(true);
    try {
      const res = await api.get('/goals', { params: { employee_id: userData.id, status: 'APPROVED' } });
      setUserGoals(res.data);
    } catch {
      setUserGoals([]);
    } finally {
      setPanelLoading(false);
    }
  }

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cascade View</h1>
        <p className="text-muted text-sm mt-0.5">Organization goal flow — click any node to view goals</p>
      </div>

      {/* Legend */}
      <div className="card p-4 flex flex-wrap gap-4">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <div key={role} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted capitalize">{role}</span>
          </div>
        ))}
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted">Click a node → view their approved goals</span>
        <span className="text-xs text-muted">Scroll to zoom · Drag to pan</span>
      </div>

      {/* D3 Tree */}
      <div className="card overflow-hidden">
        <div className="w-full overflow-auto bg-slate-50 min-h-[600px]">
          <svg ref={svgRef} style={{ display: 'block', minHeight: 600 }} />
        </div>
      </div>

      {/* Right side panel */}
      <SlideOver
        isOpen={!!selectedUser}
        onClose={() => { setSelectedUser(null); setUserGoals([]); }}
        title={selectedUser ? `${selectedUser.name}'s Goals` : ''}
      >
        {panelLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : userGoals.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <p className="text-lg mb-2">📋</p>
            <p className="font-medium">No approved goals</p>
            <p className="text-sm">This employee has no approved goals yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-primary-50 rounded-xl p-4 mb-2">
              <p className="text-sm font-semibold text-primary-800">{selectedUser?.name}</p>
              <p className="text-xs text-primary-600">{selectedUser?.department} · {selectedUser?.role}</p>
            </div>
            {userGoals.map(goal => (
              <div key={goal.id} className={`border rounded-xl p-4 ${goal.is_shared ? 'border-warning-200 bg-warning-50/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-primary-600 font-medium">{goal.thrust_area}</span>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{goal.title}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {goal.is_shared && <span className="badge bg-warning-100 text-warning-700 text-xs">Shared</span>}
                    <UomBadge type={goal.uom_type} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Target: <strong className="text-slate-700 font-mono">
                    {goal.uom_type === 'TIMELINE'
                      ? goal.target_date ? new Date(goal.target_date).toLocaleDateString('en-IN') : '—'
                      : goal.target_value ?? '—'}
                  </strong></span>
                  <span className="font-mono font-semibold text-slate-700">{goal.weightage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
