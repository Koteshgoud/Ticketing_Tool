/**
 * Organization Service: Canonical Department -> Team Lead -> Employee Service Layer
 * Supports role-based filtering, employee search by Name/ID, and relationship mappings.
 * Strictly dynamically populated from Database; zero mock data.
 */
import { apiRequestSafe } from './backendAuth';

export interface DepartmentItem {
  id: string;
  name: string;
}

export interface TeamLeadItem {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  email: string;
}

export interface EmployeeItem {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  teamLeadId: string;
  departmentId: string;
  departmentName: string;
  email: string;
}

export const DEPARTMENTS: DepartmentItem[] = [
  { id: 'D001', name: 'IT Support' },
  { id: 'D002', name: 'Finance' },
  { id: 'D003', name: 'HR' },
  { id: 'D004', name: 'Facilities' },
  { id: 'D005', name: 'General Administration' },
  { id: 'D006', name: 'Other' },
];

export const TEAM_LEADS: TeamLeadItem[] = [];

export const EMPLOYEES: EmployeeItem[] = [];

const _leadEmployeesCache = new Map<string, EmployeeItem[]>();

export const OrganizationService = {
  getDepartments(): DepartmentItem[] {
    return DEPARTMENTS;
  },

  getTeamLeadsByDepartment(deptName: string): TeamLeadItem[] {
    const norm = (deptName || '').trim().toLowerCase();
    return TEAM_LEADS.filter((tl) => {
      const tlDept = tl.departmentName.toLowerCase();
      if (tlDept === norm) return true;
      if ((norm === 'hr' || norm === 'hr operations' || norm.includes('hr')) && (tlDept === 'hr' || tlDept === 'hr operations' || tlDept.includes('hr'))) return true;
      if ((norm === 'it' || norm === 'it support') && (tlDept === 'it' || tlDept === 'it support')) return true;
      return false;
    });
  },

  async fetchEmployeesByTeamLead(teamLeadId: string): Promise<EmployeeItem[]> {
    if (!teamLeadId) return [];
    try {
      const res = await apiRequestSafe<any[]>(`/team-leads/${encodeURIComponent(teamLeadId)}/employees`);
      if (res.error) {
        throw new Error(res.error);
      }
      const raw = Array.isArray(res.data) ? res.data : [];
      const lead = this.getTeamLeadById(teamLeadId);
      const items: EmployeeItem[] = raw.map((u) => {
        const rawDept = u.department || lead?.departmentName || 'IT Support';
        const deptObj = DEPARTMENTS.find(d => d.name.toLowerCase() === rawDept.toLowerCase()) || DEPARTMENTS[0];
        return {
          id: u.id,
          employeeId: u.id,
          name: u.name,
          role: u.designation || 'Team Member',
          teamLeadId: teamLeadId,
          departmentId: deptObj.id,
          departmentName: rawDept,
          email: u.email,
        };
      });
      _leadEmployeesCache.set(teamLeadId, items);

      // Merge into canonical EMPLOYEES list without duplicate IDs
      for (const item of items) {
        const idx = EMPLOYEES.findIndex(e => e.id === item.id);
        if (idx >= 0) EMPLOYEES[idx] = item;
        else EMPLOYEES.push(item);
      }

      return items;
    } catch (e: any) {
      console.error(`Failed to fetch employees for team lead ${teamLeadId}:`, e);
      throw e;
    }
  },

  getEmployeesByTeamLead(teamLeadId: string): EmployeeItem[] {
    if (!teamLeadId) return [];
    if (_leadEmployeesCache.has(teamLeadId)) {
      return _leadEmployeesCache.get(teamLeadId)!;
    }
    // Strict isolation: only return employees explicitly mapped to this team lead ID
    return EMPLOYEES.filter((emp) => emp.teamLeadId && emp.teamLeadId === teamLeadId);
  },

  searchEmployees(teamLeadId: string, query: string): EmployeeItem[] {
    const all = this.getEmployeesByTeamLead(teamLeadId);
    if (!query || !query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q)
    );
  },

  getTeamLeadById(id: string): TeamLeadItem | undefined {
    return TEAM_LEADS.find((tl) => tl.id === id || tl.employeeId === id);
  },

  getEmployeeById(id: string): EmployeeItem | undefined {
    return EMPLOYEES.find((emp) => emp.id === id || emp.employeeId === id);
  },

  searchTeamLeads(deptName: string, query: string): TeamLeadItem[] {
    const all = this.getTeamLeadsByDepartment(deptName);
    if (!query || !query.trim()) return all;
    const q = query.trim().toLowerCase();
    return all.filter(
      (tl) =>
        tl.name.toLowerCase().includes(q) ||
        tl.employeeId.toLowerCase().includes(q)
    );
  },

  searchTeamLeadsAcrossDepartments(departments: string[], query: string): TeamLeadItem[] {
    const list: TeamLeadItem[] = [];
    const depts = departments && departments.length > 0 ? departments : ['IT Support'];
    for (const d of depts) {
      const leads = this.getTeamLeadsByDepartment(d);
      for (const lead of leads) {
        if (!list.some((existing) => existing.id === lead.id)) {
          list.push(lead);
        }
      }
    }
    if (!query || !query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter(
      (tl: TeamLeadItem) =>
        tl.name.toLowerCase().includes(q) ||
        tl.employeeId.toLowerCase().includes(q)
    );
  },

  isEmployeeIdTaken(employeeId: string): boolean {
    if (!employeeId || !employeeId.trim()) return false;
    const normalized = employeeId.trim().toUpperCase();
    const leadMatch = TEAM_LEADS.some(
      (tl) => tl.employeeId.toUpperCase() === normalized || tl.id.toUpperCase() === normalized
    );
    if (leadMatch) return true;
    return EMPLOYEES.some(
      (emp) => emp.employeeId.toUpperCase() === normalized || emp.id.toUpperCase() === normalized
    );
  },

  addTeamLead(lead: TeamLeadItem): void {
    if (!TEAM_LEADS.some((tl) => tl.employeeId.toUpperCase() === lead.employeeId.toUpperCase())) {
      TEAM_LEADS.unshift(lead);
    }
  },

  addEmployee(emp: EmployeeItem): void {
    if (!EMPLOYEES.some((e) => e.employeeId.toUpperCase() === emp.employeeId.toUpperCase())) {
      EMPLOYEES.unshift(emp);
    }
  },

  getAllTeamLeads(): TeamLeadItem[] {
    return TEAM_LEADS;
  },

  getAllEmployees(): EmployeeItem[] {
    return EMPLOYEES;
  },

  async syncFromDatabase(): Promise<void> {
    try {
      const res = await apiRequestSafe<any[]>('/users/directory');
      if (res.error || !Array.isArray(res.data)) return;
      const dbUsers = res.data;

      TEAM_LEADS.length = 0;
      EMPLOYEES.length = 0;

      const leads: any[] = [];
      const nonLeads: any[] = [];
      for (const u of dbUsers) {
        const roleLower = (u.role || '').toLowerCase();
        if (roleLower === 'teamlead' || roleLower === 'team lead') {
          leads.push(u);
        } else if (roleLower !== 'admin' && !roleLower.includes('lead')) {
          nonLeads.push(u);
        }
      }

      for (const u of leads) {
        const rawDept = u.department || 'IT Support';
        let deptName = rawDept;
        if (rawDept.toLowerCase() === 'hr' || rawDept.toLowerCase().includes('hr')) deptName = 'HR';
        else if (rawDept.toLowerCase().includes('it')) deptName = 'IT Support';
        else if (rawDept.toLowerCase().includes('fin')) deptName = 'Finance';
        else if (rawDept.toLowerCase().includes('fac')) deptName = 'Facilities';
        else if (rawDept.toLowerCase().includes('admin')) deptName = 'General Administration';

        const deptObj = DEPARTMENTS.find(d => d.name.toLowerCase() === deptName.toLowerCase() || (deptName === 'HR' && (d.name.toLowerCase() === 'hr' || d.name.toLowerCase().includes('hr')))) || DEPARTMENTS[0];
        const leadItem: TeamLeadItem = {
          id: u.id,
          employeeId: u.id,
          name: u.name,
          role: `${deptName} Team Lead`,
          departmentId: deptObj.id,
          departmentName: deptName,
          email: u.email,
        };
        (leadItem as any).team = u.team;
        TEAM_LEADS.push(leadItem);
      }

      for (const u of nonLeads) {
        const rawDept = u.department || 'IT Support';
        let deptName = rawDept;
        if (rawDept.toLowerCase() === 'hr' || rawDept.toLowerCase().includes('hr')) deptName = 'HR';
        else if (rawDept.toLowerCase().includes('it')) deptName = 'IT Support';
        else if (rawDept.toLowerCase().includes('fin')) deptName = 'Finance';
        else if (rawDept.toLowerCase().includes('fac')) deptName = 'Facilities';
        else if (rawDept.toLowerCase().includes('admin')) deptName = 'General Administration';

        const deptObj = DEPARTMENTS.find(d => d.name.toLowerCase() === deptName.toLowerCase() || (deptName === 'HR' && (d.name.toLowerCase() === 'hr' || d.name.toLowerCase().includes('hr')))) || DEPARTMENTS[0];
        let leadId = u.team_lead_id || u.team_lead || '';
        if (!leadId && u.team) {
          const matchingLead = TEAM_LEADS.find(
            (tl: any) =>
              (tl.team && tl.team.toLowerCase() === u.team.toLowerCase()) ||
              tl.id.toLowerCase() === u.team.toLowerCase()
          );
          if (matchingLead) leadId = matchingLead.id;
        }
        if (!leadId) {
          const sameDeptLeads = TEAM_LEADS.filter(tl => tl.departmentName.toLowerCase() === deptName.toLowerCase());
          if (sameDeptLeads.length === 1) leadId = sameDeptLeads[0].id;
        }

        const empItem: EmployeeItem = {
          id: u.id,
          employeeId: u.id,
          name: u.name,
          role: u.designation || 'Support Specialist',
          teamLeadId: leadId,
          departmentId: deptObj.id,
          departmentName: deptName,
          email: u.email,
        };
        EMPLOYEES.push(empItem);
      }
    } catch (e) {
      console.warn('OrganizationService: syncFromDatabase error', e);
    }
  },
};
