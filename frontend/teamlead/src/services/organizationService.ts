/**
 * Organization Service: Canonical Department -> Team Lead -> Employee Service Layer
 * Supports role-based filtering, employee search by Name/ID, and relationship mappings.
 * Strictly dynamically populated from Database; zero mock data.
 */

import { supabase } from './supabaseClient';

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
  { id: 'D003', name: 'HR Operations' },
  { id: 'D004', name: 'Facilities' },
  { id: 'D005', name: 'General Administration' },
  { id: 'D006', name: 'Other' },
];

export const TEAM_LEADS: TeamLeadItem[] = [];

export const EMPLOYEES: EmployeeItem[] = [];

export const OrganizationService = {
  getDepartments(): DepartmentItem[] {
    return DEPARTMENTS;
  },

  getTeamLeadsByDepartment(deptName: string): TeamLeadItem[] {
    const norm = (deptName || '').trim().toLowerCase();
    return TEAM_LEADS.filter(
      (tl) => tl.departmentName.toLowerCase() === norm
    );
  },

  getEmployeesByTeamLead(teamLeadId: string): EmployeeItem[] {
    return EMPLOYEES.filter((emp) => emp.teamLeadId === teamLeadId);
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
      const { data: dbUsers, error } = await supabase
        .from('users')
        .select('*');

      if (error || !dbUsers) return;

      TEAM_LEADS.length = 0;
      EMPLOYEES.length = 0;

      for (const u of dbUsers) {
        const roleLower = (u.role || '').toLowerCase();
        const rawDept = u.department || 'IT Support';
        let deptName = rawDept;
        if (rawDept.toLowerCase().includes('it')) deptName = 'IT Support';
        else if (rawDept.toLowerCase().includes('fin')) deptName = 'Finance';
        else if (rawDept.toLowerCase().includes('hr')) deptName = 'HR Operations';
        else if (rawDept.toLowerCase().includes('fac')) deptName = 'Facilities';
        else if (rawDept.toLowerCase().includes('admin')) deptName = 'General Administration';

        const deptObj = DEPARTMENTS.find(d => d.name.toLowerCase() === deptName.toLowerCase()) || DEPARTMENTS[0];

        if (roleLower === 'teamlead' || roleLower === 'team lead') {
          const leadItem: TeamLeadItem = {
            id: u.id,
            employeeId: u.id,
            name: u.name,
            role: `${deptName} Team Lead`,
            departmentId: deptObj.id,
            departmentName: deptName,
            email: u.email,
          };
          const existingIdx = TEAM_LEADS.findIndex(t => t.id === u.id || t.email === u.email);
          if (existingIdx >= 0) {
            TEAM_LEADS[existingIdx] = leadItem;
          } else {
            TEAM_LEADS.push(leadItem);
          }
        } else if (roleLower === 'employee') {
          const empItem: EmployeeItem = {
            id: u.id,
            employeeId: u.id,
            name: u.name,
            role: u.designation || 'Support Specialist',
            teamLeadId: u.team_lead_id || u.team_lead || '',
            departmentId: deptObj.id,
            departmentName: deptName,
            email: u.email,
          };
          const existingIdx = EMPLOYEES.findIndex(e => e.id === u.id || e.email === u.email);
          if (existingIdx >= 0) {
            EMPLOYEES[existingIdx] = empItem;
          } else {
            EMPLOYEES.push(empItem);
          }
        }
      }
    } catch (e) {
      console.warn('OrganizationService: syncFromDatabase error', e);
    }
  },
};
