import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  Users,
  Paperclip,
  Send,
  FileText,
  Activity,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Calendar,
  Eye,
  Download,
  Trash2,
  X
} from 'lucide-react';
import { AdminApiService, BACKEND_API_URL, fetchBackendAttachmentsDetailed } from '../../services/api';
import { authenticatedFetch, ensureBackendSession, withAccessToken } from '../../services/backendAuth';
import type { Ticket, TicketStatus } from '../../types';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { AttachmentFilePicker, type AttachedFile } from '../../components/ui/AttachmentFilePicker';
import { OrganizationService } from '../../services/organizationService';

export const AdminTicketDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const fromSource = searchParams.get('from');
  const isReadOnly = searchParams.get('mode') === 'view';

  const switchToWorkMode = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('mode', 'work');
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
  };

  const switchToViewMode = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('mode', 'view');
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
  };

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentAttachedFiles, setCommentAttachedFiles] = useState<AttachedFile[]>([]);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('In Progress');
  const [statusNote, setStatusNote] = useState('');

  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<any>('Medium');
  const [priorityNote, setPriorityNote] = useState('');

  const [showAttachModal, setShowAttachModal] = useState(false);
  const [modalAttachedFiles, setModalAttachedFiles] = useState<AttachedFile[]>([]);

  // Deadline Assignment State
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState('');
  const [isSavingDeadline, setIsSavingDeadline] = useState(false);

  // Attachment Preview & Delete Ticket States
  const [previewFile, setPreviewFile] = useState<{ name: string; url?: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadTicket = async () => {
    if (!id) return;
    setIsLoading(true);
    const found = await AdminApiService.getTicketById(id);
    if (found) {
      setTicket({ ...found });
      setSelectedStatus(found.status);
      setSelectedPriority(found.priority);
    }
    setIsLoading(false);
  };

  const handleOpenDeadlineModal = () => {
    if (!ticket) return;
    const current = ticket.dueDate || '';
    if (current && current.includes(' ')) {
      setDeadlineValue(current.replace(' ', 'T').slice(0, 16));
    } else if (current && current.includes('T')) {
      setDeadlineValue(current.slice(0, 16));
    } else {
      const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      setDeadlineValue(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
    }
    setShowDeadlineModal(true);
  };

  const handleApplyPresetDeadline = (hours: number) => {
    if (!ticket) return;
    const baseDate = ticket.createdAt ? new Date(ticket.createdAt.replace(' ', 'T')) : new Date();
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    const target = new Date(validBase.getTime() + hours * 60 * 60 * 1000);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const hh = String(target.getHours()).padStart(2, '0');
    const min = String(target.getMinutes()).padStart(2, '0');
    setDeadlineValue(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  };

  const handleSaveDeadlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !deadlineValue) return;
    setIsSavingDeadline(true);
    try {
      const formatted = deadlineValue.replace('T', ' ').slice(0, 16);
      const updated = await AdminApiService.updateTicket(id, { dueDate: formatted }, `Assigned SLA deadline to ${formatted}`);
      if (updated) {
        setTicket({ ...updated, dueDate: formatted });
      } else if (ticket) {
        setTicket({ ...ticket, dueDate: formatted });
      }
      setShowDeadlineModal(false);
      setToastMessage(`SLA Deadline assigned: ${formatted}`);
    } catch (err: any) {
      setToastMessage(`Failed to update deadline: ${err.message}`);
    } finally {
      setIsSavingDeadline(false);
    }
  };

  useEffect(() => {
    loadTicket();
    const handleUpdate = () => {
      loadTicket();
    };
    window.addEventListener('ticket-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('ticket-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [id]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleBack = () => {
    if (fromSource === 'my-tickets') {
      navigate('/admin/workspace/my-tickets');
    } else {
      navigate('/admin/workspace/all');
    }
  };

  const handleDownloadAttachment = async (file: string) => {
    const rawName = file.includes(' (') ? file.split(' (')[0] : file;
    const ticketId = ticket?.ticketNumber || id;
    try {
      await ensureBackendSession();
      const res = await authenticatedFetch(`${BACKEND_API_URL}/api/v1/tickets/${ticketId}/attachments/${encodeURIComponent(rawName)}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = rawName.includes('.') ? rawName : `${rawName}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      setToastMessage(`Could not download "${rawName}" (not found).`);
    } catch {
      setToastMessage(`Could not download "${rawName}". Please try again.`);
    }
  };

  const handleViewAttachment = async (file: string) => {
    const rawName = file.includes(' (') ? file.split(' (')[0] : file;
    const ticketId = ticket?.ticketNumber || id;
    await ensureBackendSession();
    const url = withAccessToken(`${BACKEND_API_URL}/api/v1/tickets/${ticketId}/attachments/${encodeURIComponent(rawName)}/view`);
    setPreviewFile({ name: rawName, url });
  };

  const reloadAttachments = async () => {
    if (!id || !ticket) return;
    const result = await fetchBackendAttachmentsDetailed(id);
    setTicket({
      ...ticket,
      attachments: result.attachments.map((a) =>
        a.size && a.size !== 'N/A' ? `${a.name} (${a.size})` : a.name,
      ),
      attachmentsError: result.error,
    });
  };

  const handleDeleteTicket = async () => {
    if (!ticket) return;
    setIsDeleting(true);
    try {
      const ok = await AdminApiService.deleteTicket(ticket.id);
      if (ok) {
        navigate(fromSource === 'my-tickets' ? '/admin/workspace/my-tickets' : '/admin/workspace/all');
      } else {
        setToastMessage('Failed to delete ticket. Please try again.');
        setShowDeleteModal(false);
      }
    } catch (e: any) {
      setToastMessage(`Error deleting ticket: ${e.message}`);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-2xs font-sans">
        <Clock className="w-8 h-8 text-[#0284C7] animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-600">Loading ticket details...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto mt-12 shadow-2xs font-sans">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Ticket Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          The requested ticket does not exist or may have been removed.
        </p>
        <Button variant="primary" onClick={handleBack} className="bg-[#0284C7] text-white">
          Back to Tickets
        </Button>
      </div>
    );
  }

  const matchingLeads = OrganizationService.getTeamLeadsByDepartment(ticket.department);
  const assignedTeamLeadStr = ticket.assignedTeamLead || (matchingLeads.length > 0 ? `${matchingLeads[0].name} (${matchingLeads[0].role})` : 'Unassigned');

  const handleStatusUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const note = statusNote.trim() || `Status changed to ${selectedStatus}`;
    const updated = await AdminApiService.updateTicket(id, { status: selectedStatus }, note);
    if (updated) {
      setTicket({ ...updated });
      setShowStatusModal(false);
      setStatusNote('');
      setToastMessage(`Ticket status updated to ${selectedStatus}.`);
    }
  };

  const handlePriorityUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const note = priorityNote.trim() || `Priority changed to ${selectedPriority}`;
    const updated = await AdminApiService.updateTicket(id, { priority: selectedPriority }, note);
    if (updated) {
      setTicket({ ...updated });
      setShowPriorityModal(false);
      setPriorityNote('');
      setToastMessage(`Ticket priority updated to ${selectedPriority}.`);
    }
  };

  const handleAddCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newComment.trim()) return;
    const attachmentStr = commentAttachedFiles.map((f) => `${f.name} (${f.size})`).join(', ');
    const updated = await AdminApiService.addComment(id, newComment.trim(), attachmentStr || undefined);
    if (updated) {
      setTicket({ ...updated });
      setNewComment('');
      setCommentAttachedFiles([]);
      setToastMessage('Comment posted successfully.');
    }
  };

  const handleAddAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || modalAttachedFiles.length === 0) return;
    let updatedTicket: Ticket | null = ticket;
    try {
      for (const f of modalAttachedFiles) {
        const fileNameStr = `${f.name} (${f.size})`;
        updatedTicket = await AdminApiService.addAttachment(id, fileNameStr, f.file);
      }
      if (updatedTicket) {
        setTicket({ ...updatedTicket });
        setModalAttachedFiles([]);
        setShowAttachModal(false);
        setToastMessage(`${modalAttachedFiles.length} file(s) attached successfully.`);
      }
    } catch (e: any) {
      setToastMessage(`Attachment upload failed: ${e?.message || 'unknown error'}`);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar: Back Button & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0284C7] transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {fromSource === 'my-tickets' ? 'My Tickets' : 'All Tickets'}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {isReadOnly ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                Read-Only View
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={switchToWorkMode}
                className="bg-[#0284C7] hover:bg-[#0369a1] text-white font-semibold text-xs shadow-2xs"
              >
                Work on Ticket
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={switchToViewMode}
                className="border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
              >
                <Eye className="w-3.5 h-3.5 mr-1" />
                View Only
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDeadlineModal}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
              >
                <Calendar className="w-3.5 h-3.5 mr-1 text-[#0284C7]" />
                Assign Deadline
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatus(ticket.status);
                  setShowStatusModal(true);
                }}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
              >
                Update Status
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPriority(ticket.priority);
                  setShowPriorityModal(true);
                }}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
              >
                Update Priority
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAttachModal(true)}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1" />
                Add Attachment
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Ticket Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Ticket Header & Title */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-bold text-[#0284C7] bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200">
                {ticket.ticketNumber}
              </span>
              <Badge
                variant={ticket.priority === 'Urgent' ? 'danger' : ticket.priority === 'High' ? 'warning' : 'neutral'}
                dot
                className="text-xs"
              >
                {ticket.priority}
              </Badge>
              <Badge
                variant={ticket.status === 'Escalated' ? 'danger' : ticket.status === 'In Progress' ? 'info' : ticket.status === 'Resolved' ? 'success' : 'neutral'}
                className="text-xs"
              >
                {ticket.status}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-slate-900 leading-snug">{ticket.title}</h1>
          </div>

          {/* SLA Badge */}
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-2 rounded-xl text-[#0284C7] text-xs font-medium shrink-0">
            <Clock className="w-4 h-4 text-[#0284C7]" />
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Deadline</span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleOpenDeadlineModal}
                    className="text-[10px] font-bold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="font-bold text-slate-800">{ticket.dueDate || ticket.createdAt}</div>
              <div className="text-[10px] font-semibold text-[#0284C7] mt-0.5">{ticket.slaStatus}</div>
            </div>
          </div>
        </div>

        {/* 15 Metadata Fields Display Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 bg-white border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Ticket ID
            </span>
            <span className="text-xs font-mono font-bold text-[#0284C7]">{ticket.ticketNumber}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Status
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.status}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Priority
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.priority}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Department
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.department}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Category
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.category}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Created By / Requester
            </span>
            <div className="text-xs font-semibold text-slate-800">{ticket.requesterName}</div>
            <div className="text-[10px] font-mono text-slate-400">{ticket.requesterEmail}</div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Assigned Employee
            </span>
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#0284C7]" />
              {ticket.assignedTo || 'Unassigned'}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Assigned Team Lead
            </span>
            <div className="text-xs font-semibold text-[#0284C7] flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#0284C7]" />
              {assignedTeamLeadStr}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Created Date
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.createdAt}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Last Updated Date
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.updatedAt || ticket.createdAt}</span>
          </div>

          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              SLA Status
            </span>
            <span className="text-xs font-semibold text-slate-800">{ticket.slaStatus}</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                SLA Deadline
              </span>
              <button
                type="button"
                onClick={handleOpenDeadlineModal}
                className="text-[10px] font-bold text-[#0284C7] hover:underline cursor-pointer mb-1"
              >
                Assign
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-800">{ticket.dueDate || ticket.createdAt}</span>
          </div>
        </div>

        {/* Description Section */}
        <div className="p-6 bg-white border-b border-slate-100">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Description
          </h3>
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="p-6 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
              Attachments ({ticket.attachments?.length || 0})
            </h3>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowAttachModal(true)}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer flex items-center gap-1"
              >
                + Upload File
              </button>
            )}
          </div>

          {ticket.attachmentsError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1">
                  <p className="font-semibold">Attachments could not be loaded.</p>
                  <p className="mt-0.5">{ticket.attachmentsError}</p>
                  <button
                    type="button"
                    onClick={reloadAttachments}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              </div>
            </div>
          ) : ticket.attachments && ticket.attachments.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {ticket.attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs text-slate-700 font-medium hover:border-[#0284C7] transition-all"
                >
                  <div className="flex items-center gap-2 max-w-[200px] truncate">
                    <FileText className="w-4 h-4 text-[#0284C7] shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      type="button"
                      onClick={() => handleViewAttachment(file)}
                      className="p-1 hover:bg-slate-200/80 rounded text-slate-500 hover:text-[#0284C7] transition-colors cursor-pointer"
                      title="View Attachment"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(file)}
                      className="p-1 hover:bg-slate-200/80 rounded text-slate-500 hover:text-[#0284C7] transition-colors cursor-pointer"
                      title="Download Attachment"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No attachments uploaded yet.</p>
          )}
        </div>
      </div>

      {/* Activity & Comments Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
          <Activity className="w-4 h-4 text-[#0284C7]" />
          <h2 className="text-sm font-bold text-slate-900">Comments & Activity Log</h2>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {ticket.history && ticket.history.length > 0 ? (
            ticket.history.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-xs">
                <div className="w-8 h-8 rounded-full bg-sky-50 border border-sky-100 text-[#0284C7] flex items-center justify-center font-bold shrink-0 mt-0.5">
                  {item.author.charAt(0)}
                </div>
                <div className="flex-1 bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800">{item.author}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{item.timestamp}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{item.text}</p>
                  {item.attachment && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-[#0284C7]">
                      <Paperclip className="w-3 h-3" />
                      {item.attachment}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-4">No comments or activity logged yet.</p>
          )}
        </div>

        {/* Add Comment Form or Read-Only Notice */}
        {!isReadOnly ? (
          <form onSubmit={handleAddCommentSubmit} className="pt-4 border-t border-slate-100 space-y-3">
            <label className="block text-xs font-bold text-slate-700">Add Comment / Activity Note</label>
            <textarea
              rows={3}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type your comment or update here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
            />
            <AttachmentFilePicker
              files={commentAttachedFiles}
              onFilesChange={setCommentAttachedFiles}
              label=""
              buttonText="Attach Local File to Comment"
              compact
            />
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newComment.trim()}
                className="bg-[#0284C7] hover:bg-[#0369a1] text-white font-semibold shadow-2xs"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Post Comment
              </Button>
            </div>
          </form>
        ) : (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 italic">This ticket is open in read-only view. Edit controls and comment submission are hidden.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={switchToWorkMode}
              className="text-xs font-semibold text-[#0284C7] border-sky-200 hover:bg-sky-50"
            >
              Work on Ticket
            </Button>
          </div>
        )}
      </div>

      {/* Update Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 font-sans space-y-4">
            <h3 className="text-base font-bold text-slate-900">Update Ticket Status</h3>
            <form onSubmit={handleStatusUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Status</label>
                <Select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as TicketStatus)}
                  options={[
                    { value: 'Open', label: 'Open' },
                    { value: 'In Progress', label: 'In Progress' },
                    { value: 'Pending', label: 'Pending' },
                    { value: 'Escalated', label: 'Escalated' },
                    { value: 'Resolved', label: 'Resolved' },
                    { value: 'Closed', label: 'Closed' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status Note / Activity Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Explain why status was updated..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowStatusModal(false)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-[#0284C7] text-white">
                  Save Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Priority Update Modal */}
      {showPriorityModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 font-sans space-y-4">
            <h3 className="text-base font-bold text-slate-900">Update Ticket Priority</h3>
            <form onSubmit={handlePriorityUpdateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Priority</label>
                <Select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as any)}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                    { value: 'Urgent', label: 'Urgent' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Priority Note / Activity Reason (Optional)
                </label>
                <textarea
                  rows={3}
                  value={priorityNote}
                  onChange={(e) => setPriorityNote(e.target.value)}
                  placeholder="Explain why priority was changed..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPriorityModal(false)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-[#0284C7] text-white">
                  Save Priority
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Attachment Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 font-sans space-y-4">
            <h3 className="text-base font-bold text-slate-900">Upload Attachment</h3>
            <form onSubmit={handleAddAttachmentSubmit} className="space-y-4">
              <AttachmentFilePicker
                files={modalAttachedFiles}
                onFilesChange={setModalAttachedFiles}
                existingAttachments={ticket.attachments}
                label="Select Local Computer Files"
                buttonText="Browse Files from PC"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAttachModal(false);
                    setModalAttachedFiles([]);
                  }}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={modalAttachedFiles.length === 0}
                  className="bg-[#0284C7] text-white font-semibold"
                >
                  Upload Attachments
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign / Edit SLA Deadline Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 font-sans space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#0284C7]" /> Assign SLA Deadline
              </h3>
              <button
                onClick={() => setShowDeadlineModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Set the SLA resolution deadline for ticket <strong className="text-slate-800">{ticket.ticketNumber}</strong>. Select a standard SLA preset or enter a custom date and time.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Quick SLA Presets</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPresetDeadline(4)}
                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer text-left"
                >
                  Urgent / Critical: +4 Hours
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetDeadline(8)}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer text-left"
                >
                  High: +8 Hours
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetDeadline(24)}
                  className="px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 text-xs font-semibold hover:bg-sky-100 transition-colors cursor-pointer text-left"
                >
                  Medium: +24 Hours (1 Day)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetDeadline(48)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer text-left"
                >
                  Low: +48 Hours (2 Days)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveDeadlineSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custom Resolution Deadline
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeadlineModal(false)}
                  className="border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSavingDeadline}
                  className="bg-[#0284C7] text-white font-semibold"
                >
                  {isSavingDeadline ? 'Saving...' : 'Confirm Deadline'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Attachment Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0284C7]" />
                <h3 className="text-sm font-bold text-slate-800 truncate max-w-[280px]">
                  {previewFile.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-center space-y-3 my-4 max-h-[60vh] overflow-auto">
              {previewFile.url && /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(previewFile.name) ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-h-[55vh] mx-auto rounded-lg border border-slate-200"
                  onError={() => setPreviewFile((p) => (p ? { ...p, url: undefined } : p))}
                />
              ) : previewFile.url && /\.pdf$/i.test(previewFile.name) ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[55vh] rounded-lg border border-slate-200"
                />
              ) : (
                <>
                  <FileText className="w-12 h-12 text-[#0284C7] mx-auto opacity-80" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{previewFile.name}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Ticket: {ticket.ticketNumber}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Preview is not available for this file type. Use Download to open it.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewFile(null)}
                className="border-slate-200 text-slate-600"
              >
                Close Preview
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownloadAttachment(previewFile.name)}
                className="bg-[#0284C7] text-white flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Attachment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Ticket Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-base mb-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <h3>Delete Ticket Confirmation</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete ticket <strong className="text-slate-900">{ticket.ticketNumber}</strong>? This action will remove all associated comments, activities, and attachments from the system.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteTicket}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
