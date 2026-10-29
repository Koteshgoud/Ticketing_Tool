import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ShieldCheck, Check, CheckCircle2, X, Lock, Sliders, Layers } from 'lucide-react';
import { apiRequestSafe } from '../../services/backendAuth';

interface RoleItem {
  id: string;
  name: string;
  users: number;
  description: string;
  permissions: string[];
}

interface CapabilityItem {
  id: string;
  label: string;
  category: string;
  description: string;
}

const ALL_CAPABILITIES: CapabilityItem[] = [
  {
    id: 'Manage Users',
    label: 'Manage Users',
    category: 'User Administration',
    description: 'Create, update, activate, and deactivate team accounts across portals.',
  },
  {
    id: 'Manage Tickets',
    label: 'Manage Tickets',
    category: 'Ticket Operations',
    description: 'Assign, reassign, update priority, and manage global queues.',
  },
  {
    id: 'Create Tickets',
    label: 'Create Tickets',
    category: 'Ticket Operations',
    description: 'Submit new support tickets with departmental and priority tagging.',
  },
  {
    id: 'View Own Tickets',
    label: 'View Own Tickets',
    category: 'Ticket Operations',
    description: 'Inspect status and lifecycle updates for self-submitted tickets.',
  },
  {
    id: 'Department Workflows',
    label: 'Department Workflows',
    category: 'Team Leadership',
    description: 'Oversee department queues, team assignments, and triage operations.',
  },
  {
    id: 'Configure Workflows',
    label: 'Configure Workflows',
    category: 'Governance & Rules',
    description: 'Define SLA breach policies, routing rules, and escalation paths.',
  },
  {
    id: 'View Analytics',
    label: 'View Analytics',
    category: 'Reporting & Insights',
    description: 'Access resolution performance, SLA breach metrics, and workload stats.',
  },
  {
    id: 'System Security',
    label: 'System Security',
    category: 'Governance & Rules',
    description: 'Full security configuration, credential provisioning, and token controls.',
  },
  {
    id: 'Export Audit Logs',
    label: 'Export Audit Logs',
    category: 'Reporting & Insights',
    description: 'Download compliance audit logs and historical platform activity.',
  },
];

const DEFAULT_ROLES: RoleItem[] = [
  {
    id: 'admin',
    name: 'Admin',
    users: 0,
    description: 'Unrestricted full administrative access to all tickets, configurations, and users.',
    permissions: ['Manage Users', 'Manage Tickets', 'Configure Workflows', 'View Analytics', 'System Security', 'Export Audit Logs'],
  },
  {
    id: 'teamlead',
    name: 'Team Lead',
    users: 0,
    description: 'Departmental supervisor role with ticket escalation and staff re-assignment privileges.',
    permissions: ['Manage Tickets', 'View Analytics', 'Department Workflows', 'Create Tickets', 'View Own Tickets'],
  },
  {
    id: 'employee',
    name: 'Employee',
    users: 0,
    description: 'Standard end-user role capable of submitting tickets and viewing own ticket history.',
    permissions: ['Create Tickets', 'View Own Tickets'],
  },
];

const STORAGE_KEY = 'platform_roles_matrix_v2';

export const RolesPermissionsPage: React.FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return DEFAULT_ROLES;
  });

  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editDescription, setEditDescription] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
    } catch {
      // Ignore
    }
  }, [roles]);

  useEffect(() => {
    const fetchLiveUserCounts = async () => {
      const result = await apiRequestSafe<any[]>('/admin/users');
      if (result.error || !Array.isArray(result.data)) {
        console.warn('Error fetching role counts:', result.error);
        return;
      }
      const data = result.data;
      const adminCount = data.filter((u) => (u.role || '').toLowerCase().includes('admin')).length;
      const leadCount = data.filter((u) => (u.role || '').toLowerCase().includes('lead')).length;
      const empCount = data.filter(
        (u) =>
          !(
            (u.role || '').toLowerCase().includes('admin') ||
            (u.role || '').toLowerCase().includes('lead')
          )
      ).length;

      setRoles((prev) =>
        prev.map((r) => {
          if (r.id === 'admin') return { ...r, users: adminCount };
          if (r.id === 'teamlead') return { ...r, users: leadCount };
          if (r.id === 'employee') return { ...r, users: empCount };
          return r;
        })
      );
    };
    fetchLiveUserCounts();
  }, []);

  const handleOpenEditMatrix = (role: RoleItem) => {
    setEditingRole(role);
    setEditPermissions([...role.permissions]);
    setEditDescription(role.description);
  };

  const handleTogglePermission = (capabilityId: string) => {
    setEditPermissions((prev) =>
      prev.includes(capabilityId)
        ? prev.filter((p) => p !== capabilityId)
        : [...prev, capabilityId]
    );
  };

  const handleSaveMatrix = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setRoles((prev) =>
      prev.map((r) =>
        r.id === editingRole.id
          ? {
              ...r,
              description: editDescription.trim() || r.description,
              permissions: editPermissions,
            }
          : r
      )
    );

    const savedRoleName = editingRole.name;
    setEditingRole(null);
    setToastMessage(`Permissions matrix updated successfully for ${savedRoleName}!`);

    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-white border border-emerald-200 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold text-slate-800">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 ml-auto p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="indigo" className="text-[12px] py-0.5 px-2.5">
            Administration
          </Badge>
          <span className="text-[13px] text-slate-500">Access Control Matrix</span>
        </div>
        <h1 className="text-[26px] font-bold text-slate-900 tracking-tight mt-1 mb-0">
          Roles & Permissions
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Define security clearance levels and feature flags per user role. Click &quot;Edit Matrix&quot; to configure active permissions.
        </p>
      </div>

      {/* Roles Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((r) => (
          <Card
            key={r.id}
            title={<span className="text-[16px] font-semibold text-slate-900">{r.name}</span>}
            subtitle={`${r.users} Assigned Users`}
            action={
              <Button
                variant="outline"
                size="sm"
                className="text-[12px] font-semibold hover:border-[#0284C7] hover:text-[#0284C7] cursor-pointer"
                onClick={() => handleOpenEditMatrix(r)}
              >
                <Sliders className="w-3.5 h-3.5 mr-1" />
                Edit Matrix
              </Button>
            }
          >
            <p className="text-[13px] text-slate-600 leading-relaxed mb-4 min-h-[40px]">
              {r.description}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Enabled Capabilities ({r.permissions.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.map((p) => (
                  <Badge key={p} variant="indigo" dot className="text-[11.5px] py-0.5 px-2">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit Access Matrix Modal */}
      {editingRole && (
        <Modal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          title={`Edit Access Matrix — ${editingRole.name}`}
          subtitle="Configure system permissions and feature flags for this role tier."
          maxWidth="lg"
        >
          <form onSubmit={handleSaveMatrix} className="space-y-5 pt-1">
            {/* Description Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Role Description
              </label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#0284C7] focus:bg-white transition-colors"
                placeholder="Brief summary of privileges for this role..."
              />
            </div>

            {/* Capabilities Matrix Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#0284C7]" />
                  System Capabilities ({editPermissions.length} enabled)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPermissions(ALL_CAPABILITIES.map((c) => c.id))}
                    className="text-[11px] text-[#0284C7] hover:underline font-semibold cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditPermissions([])}
                    className="text-[11px] text-slate-500 hover:underline font-medium cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto p-1 pr-2">
                {ALL_CAPABILITIES.map((cap) => {
                  const isChecked = editPermissions.includes(cap.id);
                  return (
                    <div
                      key={cap.id}
                      onClick={() => handleTogglePermission(cap.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isChecked
                          ? 'bg-sky-50/70 border-sky-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isChecked
                            ? 'bg-[#0284C7] border-[#0284C7] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 leading-tight">
                            {cap.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          {cap.description}
                        </p>
                        <span className="inline-block text-[9.5px] font-semibold text-[#0284C7] uppercase tracking-wider">
                          {cap.category}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
                className="text-xs font-semibold border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="text-xs font-semibold bg-[#0284C7] hover:bg-[#0369a1] text-white shadow-2xs"
              >
                Save Matrix Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
