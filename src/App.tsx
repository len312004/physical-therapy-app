import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  Pencil,
  Plus,
  Printer,
  Search,
  Save,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import clinicLogo from './assets/clinic-logo.png';

function autoResize(event: React.FormEvent<HTMLTextAreaElement>) {
  const el = event.currentTarget;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

type Patient = {
  id: string;
  name: string;
  diagnosis: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationality: string | null;
  attending_physician: string | null;
  status: 'active' | 'archived';
  document_data?: Record<string, string | boolean>;
  updated_at: string;
};

type Evaluation = {
  id?: string;
  patient_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  saved_at?: string;
};

type SectionKey = 'patient' | 'subjective' | 'objective' | 'assessment' | 'plan' | 'vitals' | 'goals' | 'problemGoals' | 'medicalCertificate' | 'progressReport' | 'estimateCost' | 'ptNotes';

const demoPatients = [
  { name: 'John Smith', diagnosis: 'Lower back pain', age: 45, gender: 'Male', phone: '(555) 123-4567', email: 'john.smith@email.com', address: '18 Cedar Lane' },
  { name: 'Sarah Johnson', diagnosis: 'Rotator cuff injury', age: 38, gender: 'Female', phone: '(555) 222-1004', email: 'sarah.j@email.com', address: '42 River Street' },
  { name: 'Michael Brown', diagnosis: 'Post-surgical knee rehabilitation', age: 52, gender: 'Male', phone: '(555) 318-8821', email: 'michael.b@email.com', address: '9 Oak Avenue' },
  { name: 'Emily Davis', diagnosis: 'Cervical strain', age: 29, gender: 'Female', phone: '(555) 410-6672', email: 'emily.d@email.com', address: '77 Pine Road' },
];

const emptyEvaluation = (patientId: string): Evaluation => ({ patient_id: patientId, subjective: '', objective: '', assessment: '', plan: '' });

const romFields = ['Joint', 'Motion', 'Endfeel', 'Arom', 'AromDiff', 'Prom', 'PromDiff'];
const romLabels: Record<string, string> = { Joint: 'Joint', Motion: 'Motion', Endfeel: 'Endfeel', Arom: 'Arom', AromDiff: 'Diff', Prom: 'Prom', PromDiff: 'Diff' };

function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationsByPatient, setEvaluationsByPatient] = useState<Record<string, Evaluation>>({});
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'overview' | 'evaluations' | 'archive'>('overview');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printSections, setPrintSections] = useState<Record<SectionKey, boolean>>({ patient: true, subjective: true, objective: true, assessment: true, plan: true, vitals: true, goals: true, problemGoals: true, medicalCertificate: true, progressReport: true, estimateCost: true, ptNotes: true });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const selectedPatient = patients.find((patient) => patient.id === selectedId) ?? null;
  const visiblePatients = useMemo(() => {
    const filtered = patients.filter((patient) => {
      if (viewMode === 'archive') return patient.status === 'archived';
      if (viewMode === 'evaluations') return true;
      return patient.status === 'active';
    });

    return filtered.filter((patient) => `${patient.name} ${patient.diagnosis}`.toLowerCase().includes(search.toLowerCase()));
  }, [patients, search, viewMode]);

  const patientFieldValue = (key: string) => {
    if (!selectedPatient) return '';
    const value = selectedPatient.document_data?.[key];
    return typeof value === 'boolean' ? (value ? 'true' : 'false') : (value ?? '');
  };

  const patientFieldChecked = (key: string) => {
    if (!selectedPatient) return false;
    return Boolean(selectedPatient.document_data?.[key]);
  };

  const updatePatientField = (key: string, value: string | boolean) => {
    if (!selectedPatient) return;
    setPatients((current) => current.map((patient) => patient.id === selectedPatient.id ? {
      ...patient,
      document_data: { ...(patient.document_data ?? {}), [key]: value },
      updated_at: new Date().toISOString(),
    } : patient));
  };

  useEffect(() => {
    void loadPatients();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setEvaluation(null);
      return;
    }

    const cachedEvaluation = evaluationsByPatient[selectedId] ?? emptyEvaluation(selectedId);
    setEvaluation(cachedEvaluation);
    void loadEvaluation(selectedId);
  }, [selectedId]);

  // Resize every auto-growing textarea whenever the selected patient (and thus its saved values) changes.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const areas = document.querySelectorAll<HTMLTextAreaElement>('textarea.auto-grow');
      areas.forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [selectedId, selectedPatient?.document_data]);

  async function loadPatients() {
    setLoading(true);
    const { data, error } = await supabase.from('patients').select('*').order('updated_at', { ascending: false });
    if (error) {
      setNotice('Could not load the patient list.');
      setLoading(false);
      return;
    }
    if (!data?.length) {
      const { data: seeded } = await supabase.from('patients').insert(demoPatients).select('*');
      const records = (seeded as Patient[] | null) ?? [];
      setPatients(records);
      setSelectedId(records[0]?.id ?? '');
    } else {
      const records = data as Patient[];
      setPatients(records);
      setSelectedId(records.find((patient) => patient.status === 'active')?.id ?? records[0]?.id ?? '');
    }
    setLoading(false);
  }

  async function loadEvaluation(patientId: string) {
    const { data } = await supabase.from('evaluations').select('*').eq('patient_id', patientId).maybeSingle();
    const nextEvaluation = (data as Evaluation | null) ?? emptyEvaluation(patientId);
    setEvaluationsByPatient((current) => ({ ...current, [patientId]: nextEvaluation }));
    setEvaluation(nextEvaluation);
  }

  function updateEvaluation(field: keyof Pick<Evaluation, 'subjective' | 'objective' | 'assessment' | 'plan'>, value: string) {
    setEvaluation((current) => {
      if (!current) return current;
      const nextEvaluation = { ...current, [field]: value };
      setEvaluationsByPatient((existing) => ({ ...existing, [current.patient_id]: nextEvaluation }));
      return nextEvaluation;
    });
  }

  async function saveEvaluation() {
    if (!evaluation || !selectedPatient) return;
    setSaving(true);
    const { data, error } = await supabase.from('evaluations').upsert({ ...evaluation, saved_at: new Date().toISOString() }, { onConflict: 'patient_id' }).select().maybeSingle();
    const { error: patientError } = await supabase.from('patients').update({
      document_data: selectedPatient.document_data ?? {},
      updated_at: new Date().toISOString(),
    }).eq('id', selectedPatient.id);
    if (!error && data && !patientError) {
      const savedEvaluation = data as Evaluation;
      setEvaluation(savedEvaluation);
      setEvaluationsByPatient((current) => ({ ...current, [selectedPatient.id]: savedEvaluation }));
      setNotice('Evaluation saved successfully.');
      setPatients((current) => current.map((patient) => patient.id === selectedPatient.id ? { ...patient, updated_at: new Date().toISOString() } : patient));
    } else {
      setNotice('The evaluation could not be saved.');
    }
    setSaving(false);
    window.setTimeout(() => setNotice(''), 2800);
  }

  async function savePatient(form: Omit<Patient, 'id' | 'updated_at' | 'status'>) {
    if (editingPatient) {
      const { data } = await supabase.from('patients').update({
        ...form,
        nationality: form.nationality || null,
        attending_physician: form.attending_physician || null,
        document_data: editingPatient.document_data ?? {},
        updated_at: new Date().toISOString(),
      }).eq('id', editingPatient.id).select().maybeSingle();
      if (data) setPatients((current) => current.map((patient) => patient.id === editingPatient.id ? data as Patient : patient));
      setEditingPatient(null);
      setShowPatientModal(false);
      return;
    }

    const patientPayload = {
      name: form.name.trim(),
      diagnosis: form.diagnosis || '',
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      nationality: form.nationality || null,
      attending_physician: form.attending_physician || null,
      status: 'active',
      document_data: {},
    };

    const { data, error } = await supabase.from('patients').insert(patientPayload).select().maybeSingle();
    if (error || !data) {
      setNotice('The patient could not be created.');
      setEditingPatient(null);
      setShowPatientModal(false);
      return;
    }

    const savedPatient = data as Patient;
    setSelectedId(savedPatient.id);
    setViewMode('evaluations');
    await loadPatients();
    setEditingPatient(null);
    setShowPatientModal(false);
  }

  async function toggleArchive(patient: Patient) {
    const nextStatus = patient.status === 'active' ? 'archived' : 'active';
    const { data } = await supabase.from('patients').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', patient.id).select().maybeSingle();
    if (!data) return;

    const updatedPatient = data as Patient;
    setPatients((current) => current.map((item) => item.id === patient.id ? updatedPatient : item));

    if (nextStatus === 'archived') {
      setViewMode('archive');
    } else {
      setViewMode('overview');
    }

    await loadPatients();
    setSelectedId(updatedPatient.id);
  }

  async function deletePatient(patient: Patient) {
    if (!window.confirm(`Delete ${patient.name}'s record?`)) return;
    await supabase.from('patients').delete().eq('id', patient.id);
    setPatients((current) => current.filter((item) => item.id !== patient.id));
    if (patient.id === selectedId) setSelectedId('');
  }

  function printSelected() {
    setShowPrintMenu(false);
    const nextPrintSections = { ...printSections };
    setPrintSections(nextPrintSections);
    const root = document.documentElement;
    (['patient', 'subjective', 'objective', 'assessment', 'plan', 'vitals', 'goals', 'problemGoals', 'medicalCertificate', 'progressReport', 'estimateCost', 'ptNotes'] as SectionKey[]).forEach((section) => {
      root.style.setProperty(`--print-${section}`, nextPrintSections[section] ? 'block' : 'none');
    });
    window.print();
  }

  const initials = selectedPatient?.name.split(' ').map((part) => part[0]).join('').slice(0, 2) ?? 'PT';

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Stethoscope size={20} /></div><div><strong>Motion<span>Care</span></strong><small>Physical therapy workspace</small></div></div>
        <div className="sidebar-actions"><button className="primary-button full" onClick={() => { setEditingPatient(null); setShowPatientModal(true); }}><Plus size={17} /> New patient</button></div>
        <nav className="main-nav">
          <button className={`nav-item ${viewMode === 'overview' ? 'active' : ''}`} onClick={() => setViewMode('overview')}><LayoutDashboard size={17} /> Overview</button>
          <button className={`nav-item ${viewMode === 'evaluations' ? 'active' : ''}`} onClick={() => setViewMode('evaluations')}><ClipboardList size={17} /> Evaluations <span className="nav-count">{patients.filter((patient) => patient.status === 'active').length}</span></button>
          <button className={`nav-item ${viewMode === 'archive' ? 'active' : ''}`} onClick={() => setViewMode('archive')}><Archive size={17} /> Archive <span className="nav-count">{patients.filter((patient) => patient.status === 'archived').length}</span></button>
        </nav>
        <div className="sidebar-divider" />
        <div className="patient-heading"><span>{viewMode === 'archive' ? 'Archived patients' : viewMode === 'evaluations' ? 'All patients' : 'Your patients'}</span><span>{visiblePatients.length}</span></div>
        <div className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients" /></div>
        <div className="patient-list">
          {loading ? <div className="empty-state">Loading records…</div> : visiblePatients.length ? visiblePatients.map((patient) => <button key={patient.id} className={`patient-card ${patient.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(patient.id)}><div className="patient-avatar">{patient.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div className="patient-summary"><strong>{patient.name}</strong><span>{patient.diagnosis || 'No diagnosis added'}</span></div><ChevronDown size={15} className="patient-chevron" /></button>) : <div className="empty-state">No patients found</div>}
        </div>
        <div className="sidebar-footer"><div className="profile-avatar">DA</div><div><strong>Danila May J. Oledan-Baliton</strong><span>Physical therapist</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">{viewMode === 'archive' ? 'Records / Archive' : viewMode === 'evaluations' ? 'Records / Evaluations' : 'Records / Overview'}</p><h1>{selectedPatient ? selectedPatient.name : 'Patient records'}</h1></div><div className="top-actions"><div className="save-status">{notice ? <><span className="status-dot" /> {notice}</> : 'All changes saved locally'}</div><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><button className="outline-button" onClick={() => { setEditingPatient(selectedPatient); setShowPatientModal(true); }} disabled={!selectedPatient}><Pencil size={16} /> Edit</button><button className="outline-button archive-header" onClick={() => void toggleArchive(selectedPatient)} disabled={!selectedPatient}>{selectedPatient?.status === 'active' ? <Archive size={16} /> : <ArchiveRestore size={16} />}{selectedPatient?.status === 'active' ? 'Archive patient' : 'Restore patient'}</button><button className="primary-button save-header" onClick={() => void saveEvaluation()} disabled={!selectedPatient || saving}><Save size={16} /> {saving ? 'Saving…' : 'Save evaluation'}</button><div className="print-wrap"><button className="dark-button" onClick={() => setShowPrintMenu((current) => !current)} disabled={!selectedPatient}><Printer size={16} /> Print selected <ChevronDown size={14} /></button>{showPrintMenu && <div className="print-menu"><div className="print-menu-title">Select pages to print</div>{(['patient', 'objective', 'vitals', 'goals', 'plan', 'problemGoals', 'medicalCertificate', 'progressReport', 'estimateCost', 'ptNotes'] as SectionKey[]).map((section, index) => <label key={section}><input type="checkbox" checked={printSections[section]} onChange={(event) => setPrintSections((current) => ({ ...current, [section]: event.target.checked }))} /><span>Page {index + 1}</span></label>)}<button className="primary-button full" onClick={printSelected}><Printer size={15} /> Print pages</button></div>}</div></div></header>
        {selectedPatient && evaluation ? <div className="record-layout">
          <section className="record-card patient-info" data-print-section="patient">
            <div className="patient-info-document">
              <header className="patient-info-document-header">
                <div className="document-logo-wrap">
                  <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
                </div>
                <div className="document-branding">
                  <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                  <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                  <p>+639293310697 / +639085982802 / +6392743043238</p>
                </div>
              </header>

              <div className="patient-info-body">
                <h2>Patient's Information:</h2>
                <ul className="patient-info-list">
                  <li><span>Name:</span> {selectedPatient.name}</li>
                  <li><span>Address:</span> {selectedPatient.address || 'N/A'}</li>
                  <li><span>Age:</span> {selectedPatient.age ?? 'N/A'}</li>
                  <li><span>Gender:</span> {selectedPatient.gender ?? 'null'}</li>
                  <li><span>Phone/Email:</span> {selectedPatient.phone || 'N/A'} / {selectedPatient.email || 'N/A'}</li>
                  <li><span>Nationality:</span> {selectedPatient.nationality || 'N/A'}</li>
                  <li><span>Attending Physician:</span> {selectedPatient.attending_physician || 'N/A'}</li>
                  <li><span>Diagnosis:</span> {selectedPatient.diagnosis || 'N/A'}</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="initial-evaluation-page page-break-page-2" data-print-section="objective">
            <header className="initial-evaluation-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />

              </div>
              <div className="document-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>
            <h2 className="initial-evaluation-title">Initial Evaluation</h2>

            <div className="initial-evaluation-block">
              <div className="initial-evaluation-row initial-evaluation-row-header">
                <span>PATIENT'S GOALS:</span>
              </div>
              <div className="initial-evaluation-divider" />
              <textarea key={`patientGoals-${selectedId}`} className="patient-goals-input auto-grow" onInput={autoResize} placeholder="Type patient goals here..." aria-label="Patient goals" name="patientGoals" value={String(patientFieldValue('patientGoals'))} onChange={(event) => updatePatientField('patientGoals', event.target.value)} />
            </div>

            <div className="initial-evaluation-block">
              <div className="initial-evaluation-row initial-evaluation-row-header">
                <span>PAIN ASSESSMENT:</span>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Pain Score:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="painScoreNoPain" checked={patientFieldChecked('painScoreNoPain')} onChange={(event) => updatePatientField('painScoreNoPain', event.target.checked)} /><span>No pain (0/5)</span></label>
                  <label className="check-option"><input type="checkbox" name="painScoreVeryMild" checked={patientFieldChecked('painScoreVeryMild')} onChange={(event) => updatePatientField('painScoreVeryMild', event.target.checked)} /><span>Very mild (1/5)</span></label>
                  <label className="check-option"><input type="checkbox" name="painScoreMild" checked={patientFieldChecked('painScoreMild')} onChange={(event) => updatePatientField('painScoreMild', event.target.checked)} /><span>Mild (2/5)</span></label>
                  <label className="check-option"><input type="checkbox" name="painScoreModerate" checked={patientFieldChecked('painScoreModerate')} onChange={(event) => updatePatientField('painScoreModerate', event.target.checked)} /><span>Moderate (3/5)</span></label>
                  <label className="check-option"><input type="checkbox" name="painScoreSevere" checked={patientFieldChecked('painScoreSevere')} onChange={(event) => updatePatientField('painScoreSevere', event.target.checked)} /><span>Severe (4/5)</span></label>
                  <label className="check-option"><input type="checkbox" name="painScoreVerySevere" checked={patientFieldChecked('painScoreVerySevere')} onChange={(event) => updatePatientField('painScoreVerySevere', event.target.checked)} /><span>Very severe (5/5)</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Pattern:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="patternAllTheTime" checked={patientFieldChecked('patternAllTheTime')} onChange={(event) => updatePatientField('patternAllTheTime', event.target.checked)} /><span>All the time</span></label>
                  <label className="check-option"><input type="checkbox" name="patternLocalized" checked={patientFieldChecked('patternLocalized')} onChange={(event) => updatePatientField('patternLocalized', event.target.checked)} /><span>Localized</span></label>
                  <label className="check-option"><input type="checkbox" name="patternRadiating" checked={patientFieldChecked('patternRadiating')} onChange={(event) => updatePatientField('patternRadiating', event.target.checked)} /><span>Radiating</span></label>
                  <label className="check-option"><input type="checkbox" name="patternConstant" checked={patientFieldChecked('patternConstant')} onChange={(event) => updatePatientField('patternConstant', event.target.checked)} /><span>Constant</span></label>
                  <label className="check-option"><input type="checkbox" name="patternIntermittent" checked={patientFieldChecked('patternIntermittent')} onChange={(event) => updatePatientField('patternIntermittent', event.target.checked)} /><span>Intermittent</span></label>
                  <label className="check-option"><input type="checkbox" name="patternHardToLocalize" checked={patientFieldChecked('patternHardToLocalize')} onChange={(event) => updatePatientField('patternHardToLocalize', event.target.checked)} /><span>Hard to localize</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Quality of Pain:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="qualityDiffused" checked={patientFieldChecked('qualityDiffused')} onChange={(event) => updatePatientField('qualityDiffused', event.target.checked)} /><span>Diffused aching, poorly localized</span></label>
                  <label className="check-option"><input type="checkbox" name="qualitySharp" checked={patientFieldChecked('qualitySharp')} onChange={(event) => updatePatientField('qualitySharp', event.target.checked)} /><span>Sharp, bright, burning</span></label>
                  <label className="check-option"><input type="checkbox" name="qualityDeep" checked={patientFieldChecked('qualityDeep')} onChange={(event) => updatePatientField('qualityDeep', event.target.checked)} /><span>Deep, nagging, dull aching</span></label>
                  <label className="check-option"><input type="checkbox" name="qualityCramping" checked={patientFieldChecked('qualityCramping')} onChange={(event) => updatePatientField('qualityCramping', event.target.checked)} /><span>Cramping, dull aching</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Associated Symptoms:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="symptomSOB" checked={patientFieldChecked('symptomSOB')} onChange={(event) => updatePatientField('symptomSOB', event.target.checked)} /><span>SOB</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomDizziness" checked={patientFieldChecked('symptomDizziness')} onChange={(event) => updatePatientField('symptomDizziness', event.target.checked)} /><span>Dizziness</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomBurning" checked={patientFieldChecked('symptomBurning')} onChange={(event) => updatePatientField('symptomBurning', event.target.checked)} /><span>Burning</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomNumbness" checked={patientFieldChecked('symptomNumbness')} onChange={(event) => updatePatientField('symptomNumbness', event.target.checked)} /><span>Numbness</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomRest" checked={patientFieldChecked('symptomRest')} onChange={(event) => updatePatientField('symptomRest', event.target.checked)} /><span>Rest</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomStress" checked={patientFieldChecked('symptomStress')} onChange={(event) => updatePatientField('symptomStress', event.target.checked)} /><span>Stress</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomExercise" checked={patientFieldChecked('symptomExercise')} onChange={(event) => updatePatientField('symptomExercise', event.target.checked)} /><span>Exercise</span></label>
                  <label className="check-option"><input type="checkbox" name="symptomPosition" checked={patientFieldChecked('symptomPosition')} onChange={(event) => updatePatientField('symptomPosition', event.target.checked)} /><span>Position</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Aggravating Factor:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="aggravatingRest" checked={patientFieldChecked('aggravatingRest')} onChange={(event) => updatePatientField('aggravatingRest', event.target.checked)} /><span>Rest</span></label>
                  <label className="check-option"><input type="checkbox" name="aggravatingPosition" checked={patientFieldChecked('aggravatingPosition')} onChange={(event) => updatePatientField('aggravatingPosition', event.target.checked)} /><span>Position</span></label>
                  <label className="check-option"><input type="checkbox" name="aggravatingActivities" checked={patientFieldChecked('aggravatingActivities')} onChange={(event) => updatePatientField('aggravatingActivities', event.target.checked)} /><span>Activities</span></label>
                  <label className="check-option"><input type="checkbox" name="aggravatingMedications" checked={patientFieldChecked('aggravatingMedications')} onChange={(event) => updatePatientField('aggravatingMedications', event.target.checked)} /><span>Medications</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Relieving Factor:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="relievingAM" checked={patientFieldChecked('relievingAM')} onChange={(event) => updatePatientField('relievingAM', event.target.checked)} /><span>AM</span></label>
                  <label className="check-option"><input type="checkbox" name="relievingDayProgress" checked={patientFieldChecked('relievingDayProgress')} onChange={(event) => updatePatientField('relievingDayProgress', event.target.checked)} /><span>As the day progresses</span></label>
                  <label className="check-option"><input type="checkbox" name="relievingPM" checked={patientFieldChecked('relievingPM')} onChange={(event) => updatePatientField('relievingPM', event.target.checked)} /><span>PM</span></label>
                  <label className="check-option"><input type="checkbox" name="relievingRest" checked={patientFieldChecked('relievingRest')} onChange={(event) => updatePatientField('relievingRest', event.target.checked)} /><span>Rest</span></label>
                  <label className="check-option"><input type="checkbox" name="relievingPosition" checked={patientFieldChecked('relievingPosition')} onChange={(event) => updatePatientField('relievingPosition', event.target.checked)} /><span>Position</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Symptoms are Better:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="betterAM" checked={patientFieldChecked('betterAM')} onChange={(event) => updatePatientField('betterAM', event.target.checked)} /><span>AM</span></label>
                  <label className="check-option"><input type="checkbox" name="betterDayProgress" checked={patientFieldChecked('betterDayProgress')} onChange={(event) => updatePatientField('betterDayProgress', event.target.checked)} /><span>As the day progresses</span></label>
                  <label className="check-option"><input type="checkbox" name="betterPM" checked={patientFieldChecked('betterPM')} onChange={(event) => updatePatientField('betterPM', event.target.checked)} /><span>PM</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row">
                <div className="initial-evaluation-label">Symptoms are Worse:</div>
                <div className="initial-evaluation-options">
                  <label className="check-option"><input type="checkbox" name="worseAM" checked={patientFieldChecked('worseAM')} onChange={(event) => updatePatientField('worseAM', event.target.checked)} /><span>AM</span></label>
                  <label className="check-option"><input type="checkbox" name="worseDayProgress" checked={patientFieldChecked('worseDayProgress')} onChange={(event) => updatePatientField('worseDayProgress', event.target.checked)} /><span>As the day progresses</span></label>
                  <label className="check-option"><input type="checkbox" name="worsePM" checked={patientFieldChecked('worsePM')} onChange={(event) => updatePatientField('worsePM', event.target.checked)} /><span>PM</span></label>
                </div>
              </div>

              <div className="initial-evaluation-field-row medication-row">
                <div className="initial-evaluation-label">Medication(s):</div>
                <textarea key={`medications-${selectedId}`} className="medication-input auto-grow" rows={1} onInput={autoResize} placeholder="Type medication(s) here..." aria-label="Medication list" name="medications" value={String(patientFieldValue('medications'))} onChange={(event) => updatePatientField('medications', event.target.value)} />
              </div>
            </div>
          </section>

          <section className="vital-signs-page page-break-page-3" data-print-section="vitals">
            <div className="vital-signs-content">
              <div className="vital-signs-row">
                <span className="vital-signs-label">O: VITAL SIGNS:</span>
              </div>

              <div className="vital-signs-inline-row">
                <div className="vital-signs-field"><span>BP:</span><input type="text" value={String(patientFieldValue('vitalsBP'))} onChange={(event) => updatePatientField('vitalsBP', event.target.value)} placeholder="" /></div>
                <div className="vital-signs-unit">mmHg</div>
                <div className="vital-signs-field"><span>PR:</span><input type="text" value={String(patientFieldValue('vitalsPR'))} onChange={(event) => updatePatientField('vitalsPR', event.target.value)} placeholder="" /></div>
                <div className="vital-signs-unit">bpm</div>
              </div>

              <div className="vital-signs-inline-row dual-row">
                <div className="vital-signs-field"><span>RR:</span><input type="text" value={String(patientFieldValue('vitalsRR'))} onChange={(event) => updatePatientField('vitalsRR', event.target.value)} placeholder="" /></div>
                <div className="vital-signs-unit">cpm</div>
              </div>

              <div className="vital-signs-row">
                <span className="vital-signs-label">ROM:</span>
              </div>

              <div className="rom-table-wrap">
                <table className="rom-table">
                  <thead>
                    <tr>
                      <th>JOINT</th>
                      <th>MOTION</th>
                      <th>ENDFEEL (N)</th>
                      <th>AROM</th>
                      <th>DIFF</th>
                      <th>PROM</th>
                      <th>DIFF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        {romFields.map((field) => (
                          <td key={field}>
                            <input
                              type="text"
                              className="rom-cell-input"
                              aria-label={`${romLabels[field]} ${index + 1}`}
                              value={String(patientFieldValue(`rom${field}${index}`))}
                              onChange={(event) => updatePatientField(`rom${field}${index}`, event.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="vital-signs-significance">
                <span>Significance:</span>
                <textarea key={`vitalsSignificance-${selectedId}`} className="significance-input auto-grow" rows={1} onInput={autoResize} placeholder="" aria-label="Significance" value={String(patientFieldValue('vitalsSignificance'))} onChange={(event) => updatePatientField('vitalsSignificance', event.target.value)} />
              </div>

              <div className="vital-signs-row">
                <span className="vital-signs-label">MANUAL MUSCLE TESTING:</span>
              </div>

              <textarea className="manual-muscle-box auto-grow" aria-label="Manual muscle testing" placeholder="" value={String(patientFieldValue('manualMuscleTesting'))} onChange={(event) => updatePatientField('manualMuscleTesting', event.target.value)} />

              <div className="vital-signs-significance secondary-significance">
                <span>Significance:</span>
                <textarea key={`manualMuscleSignificance-${selectedId}`} className="significance-input auto-grow" rows={1} onInput={autoResize} placeholder="" aria-label="Manual muscle testing significance" value={String(patientFieldValue('manualMuscleSignificance'))} onChange={(event) => updatePatientField('manualMuscleSignificance', event.target.value)} />
              </div>
            </div>
          </section>

          <section className="goals-page page-break-page-4" data-print-section="goals">
            <div className="goals-page-content">
              <div className="goals-form-block">
                <div className="goals-line-row">
                  <span className="goals-label">A: PROBLEM LIST:</span>
                </div>
                <textarea className="goals-problem-box auto-grow" aria-label="Problem list" value={String(patientFieldValue('problemList'))} onChange={(event) => updatePatientField('problemList', event.target.value)} />
              </div>

              <div className="goals-form-block">
                <div className="goals-line-row">
                  <span className="goals-label">LONG TERM GOALS:</span>
                  <span className="goals-middle-text">(Achievable within</span>
                  <textarea key={`longTermGoalsSessions-${selectedId}`} className="goals-inline-input auto-grow" rows={1} onInput={autoResize} aria-label="Long term goals treatment sessions" value={String(patientFieldValue('longTermGoalsSessions'))} onChange={(event) => updatePatientField('longTermGoalsSessions', event.target.value)} />
                  <span className="goals-middle-text">treatment sessions)</span>
                </div>
                <textarea className="goals-box auto-grow" aria-label="Long term goals" value={String(patientFieldValue('longTermGoalsText'))} onChange={(event) => updatePatientField('longTermGoalsText', event.target.value)} />
              </div>

              <div className="goals-form-block">
                <div className="goals-line-row">
                  <span className="goals-label">SHORT TERM GOALS:</span>
                  <span className="goals-middle-text">(Achievable within</span>
                  <textarea key={`shortTermGoalsSessions-${selectedId}`} className="goals-inline-input auto-grow" rows={1} onInput={autoResize} aria-label="Short term goals treatment sessions" value={String(patientFieldValue('shortTermGoalsSessions'))} onChange={(event) => updatePatientField('shortTermGoalsSessions', event.target.value)} />
                  <span className="goals-middle-text">treatment sessions)</span>
                </div>
                <textarea className="goals-box auto-grow" aria-label="Short term goals" value={String(patientFieldValue('shortTermGoalsText'))} onChange={(event) => updatePatientField('shortTermGoalsText', event.target.value)} />
                <div className="short-term-goals-footer">
                  <div className="short-term-goals-impression-row">
                    <span className="short-term-goals-impression">PT IMPRESSION: REHABILITATION POTENTIAL:</span>
                    <div className="short-term-goals-options">
                      <label className="checkbox-option">
                        <input type="checkbox" checked={patientFieldChecked('rehabPotentialGood')} onChange={(event) => updatePatientField('rehabPotentialGood', event.target.checked)} />
                        <span>Good</span>
                      </label>
                      <label className="checkbox-option">
                        <input type="checkbox" checked={patientFieldChecked('rehabPotentialFair')} onChange={(event) => updatePatientField('rehabPotentialFair', event.target.checked)} />
                        <span>Fair</span>
                      </label>
                      <label className="checkbox-option">
                        <input type="checkbox" checked={patientFieldChecked('rehabPotentialPoor')} onChange={(event) => updatePatientField('rehabPotentialPoor', event.target.checked)} />
                        <span>Poor</span>
                      </label>
                    </div>
                  </div>
                  <textarea key={`ptImpressionNotes-${selectedId}`} className="short-term-goals-input-line auto-grow" rows={1} onInput={autoResize} aria-label="PT impression notes" value={String(patientFieldValue('ptImpressionNotes'))} onChange={(event) => updatePatientField('ptImpressionNotes', event.target.value)} />
                </div>
              </div>
            </div>
          </section>

          <section className="treatment-plan-page page-break-page-5" data-print-section="plan">
            <div className="treatment-plan-content">
              <div className="treatment-plan-row">
                <span className="treatment-plan-label">P: PLAN TREATMENT:</span>
                <span className="treatment-plan-text">Frequency:</span>
                <label className="treatment-plan-option">
                  <input type="checkbox" checked={patientFieldChecked('freqDaily')} onChange={(event) => updatePatientField('freqDaily', event.target.checked)} />
                  <span>Daily</span>
                </label>
                <label className="treatment-plan-option">
                  <input type="checkbox" checked={patientFieldChecked('freqEOD')} onChange={(event) => updatePatientField('freqEOD', event.target.checked)} />
                  <span>EOD</span>
                </label>
                <label className="treatment-plan-option">
                  <input type="checkbox" checked={patientFieldChecked('freqOthers')} onChange={(event) => updatePatientField('freqOthers', event.target.checked)} />
                  <span>Others</span>
                </label>
                <textarea key={`freqOthersText-${selectedId}`} className="treatment-plan-inline-input auto-grow" rows={1} onInput={autoResize} aria-label="Other treatment frequency" value={String(patientFieldValue('freqOthersText'))} onChange={(event) => updatePatientField('freqOthersText', event.target.value)} />
              </div>

              <div className="treatment-plan-box-wrap">
                <textarea className="treatment-plan-box auto-grow" aria-label="Plan treatment text" value={String(patientFieldValue('planTreatmentText'))} onChange={(event) => updatePatientField('planTreatmentText', event.target.value)} />
              </div>

              <div className="treatment-plan-row treatment-plan-row-header">
                <span className="treatment-plan-label">HOME INSTRUCTIONS/RECOMMENDATIONS - Patient/Family Education:</span>
              </div>

              <div className="treatment-plan-box-wrap">
                <textarea className="treatment-plan-box auto-grow" aria-label="Home instructions and recommendations" value={String(patientFieldValue('homeInstructionsText'))} onChange={(event) => updatePatientField('homeInstructionsText', event.target.value)} />
              </div>

              <div className="treatment-plan-signature-row">
                <textarea key={`treatmentPlanSignature-${selectedId}`} className="treatment-plan-signature-line auto-grow" rows={1} onInput={autoResize} aria-label="Physical Therapist/Date" value={String(patientFieldValue('treatmentPlanSignature'))} onChange={(event) => updatePatientField('treatmentPlanSignature', event.target.value)} />
                <span>Physical Therapist/Date</span>
              </div>
            </div>
          </section>

          <section className="problem-goals-page page-break-page-6" data-print-section="problemGoals">
            <header className="problem-goals-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
                
              </div>
              <div className="document-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>

            <div className="problem-goals-block">
              <div className="problem-goals-title">PRESENT PROBLEM LIST:</div>
              <textarea className="problem-goals-box auto-grow" aria-label="Present problem list" value={String(patientFieldValue('presentProblemList'))} onChange={(event) => updatePatientField('presentProblemList', event.target.value)} />
            </div>

            <div className="problem-goals-block">
              <div className="problem-goals-title">RECOMMENDATION / GOALS:</div>
              <textarea className="problem-goals-box auto-grow" aria-label="Recommendation and goals" value={String(patientFieldValue('recommendationGoals'))} onChange={(event) => updatePatientField('recommendationGoals', event.target.value)} />
            </div>

            <div className="problem-goals-signature-row">
              <textarea key={`problemGoalsSignature-${selectedId}`} className="problem-goals-signature-line auto-grow" rows={1} onInput={autoResize} aria-label="Physical therapist in charge" value={String(patientFieldValue('problemGoalsSignature'))} onChange={(event) => updatePatientField('problemGoalsSignature', event.target.value)} />
              <div className="problem-goals-signature-text">
                <span>PHYSICAL THERAPIST IN-CHARGE</span>
                <span>LIC.# 23167</span>
              </div>
            </div>
          </section>

          <section className="medical-certificate-page page-break-page-7" data-print-section="medicalCertificate">
            <header className="medical-certificate-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
                
              </div>
              <div className="document-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>Real Street, Barangay Songco, Borongan Eastern Samar</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>

            <h2 className="medical-certificate-title">MEDICAL CERTIFICATE</h2>

            <div className="medical-certificate-body">
              <p>
                This is to certify that patient <textarea key={`certName-${selectedId}`} className="medical-fill medical-fill-name auto-grow" rows={1} onInput={autoResize} aria-label="Patient name" value={String(patientFieldValue('certName'))} onChange={(event) => updatePatientField('certName', event.target.value)} />,{' '}
                <textarea key={`certAge-${selectedId}`} className="medical-fill medical-fill-age auto-grow" rows={1} onInput={autoResize} aria-label="Patient age" value={String(patientFieldValue('certAge'))} onChange={(event) => updatePatientField('certAge', event.target.value)} /> years old, resides in{' '}
                <textarea key={`certAddress-${selectedId}`} className="medical-fill medical-fill-address auto-grow" rows={1} onInput={autoResize} aria-label="Patient address" value={String(patientFieldValue('certAddress'))} onChange={(event) => updatePatientField('certAddress', event.target.value)} /> Eastern Samar, diagnosed with{' '}
                <textarea key={`certDiagnosis-${selectedId}`} className="medical-fill medical-fill-diagnosis auto-grow" rows={1} onInput={autoResize} aria-label="Diagnosis" value={String(patientFieldValue('certDiagnosis'))} onChange={(event) => updatePatientField('certDiagnosis', event.target.value)} />.
              </p>

              <p>
                He was advised by <textarea key={`certDoctor-${selectedId}`} className="medical-fill medical-fill-doctor auto-grow" rows={1} onInput={autoResize} aria-label="Doctor" value={String(patientFieldValue('certDoctor'))} onChange={(event) => updatePatientField('certDoctor', event.target.value)} /> to undergo Physical
                Therapy sessions at Borongan Physical Therapy Center. Received this certification this day of{' '}
                <textarea key={`certDate-${selectedId}`} className="medical-fill medical-fill-date auto-grow" rows={1} onInput={autoResize} aria-label="Certification date" value={String(patientFieldValue('certDate'))} onChange={(event) => updatePatientField('certDate', event.target.value)} />.
              </p>

              <p>
                The therapy was advised 3 times per week alternately up to recovery period.
              </p>

              <p>
                This document is for disclosure and may serve for any legal purposes. For any questions
                please contact us for verification.
              </p>
            </div>

            <div className="medical-certificate-signature">
              <div className="signature-name-wrap">
                <div className="signature-name">Danila May J. Oledan-Baliton, PTRP</div>
              </div>
              <div className="signature-meta">
                <div className="signature-title">PHYSICAL THERAPIST</div>
                <div className="signature-license">Lic. No. 23167</div>
              </div>
            </div>
          </section>

          <section className="progress-report-page page-break-page-8" data-print-section="progressReport">
            <header className="progress-report-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
                
              </div>
              <div className="progress-report-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>

            <div className="progress-report-body">
              <h2>PROGRESS REPORT</h2>

              <div className="progress-report-form">
                <div className="progress-report-row progress-report-row-form">
                  <span className="progress-report-label">Name:</span>
                  <textarea key={`progressName-${selectedId}`} className="progress-report-line progress-report-line-form auto-grow" rows={1} onInput={autoResize} aria-label="Name" value={String(patientFieldValue('progressName'))} onChange={(event) => updatePatientField('progressName', event.target.value)} />
                </div>
                <div className="progress-report-row progress-report-row-form">
                  <span className="progress-report-label">Evaluation Date:</span>
                  <textarea key={`progressEvalDate-${selectedId}`} className="progress-report-line progress-report-line-form auto-grow" rows={1} onInput={autoResize} aria-label="Evaluation Date" value={String(patientFieldValue('progressEvalDate'))} onChange={(event) => updatePatientField('progressEvalDate', event.target.value)} />
                </div>
                <div className="progress-report-row progress-report-row-form">
                  <span className="progress-report-label">Diagnosis:</span>
                  <textarea key={`progressDiagnosis-${selectedId}`} className="progress-report-line progress-report-line-form auto-grow" rows={1} onInput={autoResize} aria-label="Diagnosis" value={String(patientFieldValue('progressDiagnosis'))} onChange={(event) => updatePatientField('progressDiagnosis', event.target.value)} />
                </div>
                <div className="progress-report-row progress-report-row-form">
                  <span className="progress-report-label">Referring Physician:</span>
                  <textarea key={`progressReferringPhysician-${selectedId}`} className="progress-report-line progress-report-line-form auto-grow" rows={1} onInput={autoResize} aria-label="Referring Physician" value={String(patientFieldValue('progressReferringPhysician'))} onChange={(event) => updatePatientField('progressReferringPhysician', event.target.value)} />
                </div>
                <div className="progress-report-row progress-report-row-form">
                  <span className="progress-report-label">Date:</span>
                  <textarea key={`progressDate-${selectedId}`} className="progress-report-line progress-report-line-form auto-grow" rows={1} onInput={autoResize} aria-label="Date" value={String(patientFieldValue('progressDate'))} onChange={(event) => updatePatientField('progressDate', event.target.value)} />
                </div>
              </div>

              <div className="progress-report-section">
                <h3>TREATMENT GIVEN:</h3>
                 <textarea className="problem-goals-box auto-grow" aria-label="Treatment given" value={String(patientFieldValue('treatmentGiven'))} onChange={(event) => updatePatientField('treatmentGiven', event.target.value)} />
              </div>

              <div className="progress-report-section">
                <h3>PREVIOUS PROBLEM LIST:</h3>
               <textarea className="problem-goals-box auto-grow" aria-label="Previous problem list" value={String(patientFieldValue('previousProblemList'))} onChange={(event) => updatePatientField('previousProblemList', event.target.value)} />
              </div>

              <div className="progress-report-section progress-report-section-nested">
                <h3>PROGRESS EVALUATION:</h3>
                <textarea className="problem-goals-box auto-grow" aria-label="Progress evaluation" value={String(patientFieldValue('progressEvaluationText'))} onChange={(event) => updatePatientField('progressEvaluationText', event.target.value)} />
              </div>
            </div>
          </section>

          <section className="estimate-cost-page page-break-page-9" data-print-section="estimateCost">
            <header className="estimate-cost-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
                
              </div>
              <div className="estimate-cost-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>

            <div className="estimate-cost-date-row">
              <span>DATE:</span>
              <textarea key={`estimateDate-${selectedId}`} className="estimate-cost-date-line auto-grow" rows={1} onInput={autoResize} aria-label="Date" value={String(patientFieldValue('estimateDate'))} onChange={(event) => updatePatientField('estimateDate', event.target.value)} />
            </div>

            <div className="estimate-cost-body">
              <div className="estimate-cost-intro">TO WHOM IT MAY CONCERN;</div>

              <h2>ESTIMATED COST FOR PHYSICAL THERAPY SESSIONS</h2>

              <div className="estimate-cost-row">
                <span className="estimate-cost-label">PATIENT'S NAME:</span>
                <textarea key={`estimatePatientName-${selectedId}`} className="estimate-cost-line auto-grow" rows={1} onInput={autoResize} aria-label="Patient name" value={String(patientFieldValue('estimatePatientName'))} onChange={(event) => updatePatientField('estimatePatientName', event.target.value)} />
              </div>
              <div className="estimate-cost-row">
                <span className="estimate-cost-label">DIAGNOSIS:</span>
                <textarea key={`estimateDiagnosis-${selectedId}`} className="estimate-cost-line auto-grow" rows={1} onInput={autoResize} aria-label="Diagnosis" value={String(patientFieldValue('estimateDiagnosis'))} onChange={(event) => updatePatientField('estimateDiagnosis', event.target.value)} />
              </div>
              <div className="estimate-cost-row">
                <span className="estimate-cost-label">PROFESSIONAL FEE:</span>
                <textarea key={`estimateProfessionalFee-${selectedId}`} className="estimate-cost-line auto-grow" rows={1} onInput={autoResize} aria-label="Professional fee" value={String(patientFieldValue('estimateProfessionalFee'))} onChange={(event) => updatePatientField('estimateProfessionalFee', event.target.value)} />
              </div>
              <div className="estimate-cost-row">
                <span className="estimate-cost-label">MACHINE REQUIRED:</span>
                <textarea key={`estimateMachineRequired-${selectedId}`} className="estimate-cost-line auto-grow" rows={1} onInput={autoResize} aria-label="Machine required" value={String(patientFieldValue('estimateMachineRequired'))} onChange={(event) => updatePatientField('estimateMachineRequired', event.target.value)} />
              </div>

              <div className="estimate-cost-machine-list">
                <label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineElectricalStimulator')} onChange={(event) => updatePatientField('machineElectricalStimulator', event.target.checked)} /><span className="estimate-cost-check-text">Electrical Stimulator</span><span className="estimate-cost-check-line" /></label><label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineTENS')} onChange={(event) => updatePatientField('machineTENS', event.target.checked)} /><span className="estimate-cost-check-text">TENS Machine</span><span className="estimate-cost-check-line" /></label><label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineHMP')} onChange={(event) => updatePatientField('machineHMP', event.target.checked)} /><span className="estimate-cost-check-text">HMP Machine</span><span className="estimate-cost-check-line" /></label><label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineUltrasound')} onChange={(event) => updatePatientField('machineUltrasound', event.target.checked)} /><span className="estimate-cost-check-text">Ultrasound Machine</span><span className="estimate-cost-check-line" /></label><label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineIRR')} onChange={(event) => updatePatientField('machineIRR', event.target.checked)} /><span className="estimate-cost-check-text">IRR Machine</span><span className="estimate-cost-check-line" /></label><label className="estimate-cost-check"><input type="checkbox" checked={patientFieldChecked('machineParaffin')} onChange={(event) => updatePatientField('machineParaffin', event.target.checked)} /><span className="estimate-cost-check-text">Paraffin Machine</span><span className="estimate-cost-check-line" /></label>
              </div>

              <div className="estimate-cost-lower-block">
                <div className="estimate-cost-lower-row">
                  <span className="estimate-cost-lower-label">FREQUENCY OF THERAPY SESSIONS:</span>
                  <textarea key={`estimateFrequency-${selectedId}`} className="estimate-cost-lower-line auto-grow" rows={1} onInput={autoResize} aria-label="Frequency of therapy sessions" value={String(patientFieldValue('estimateFrequency'))} onChange={(event) => updatePatientField('estimateFrequency', event.target.value)} />
                </div>
                <div className="estimate-cost-lower-row">
                  <span className="estimate-cost-lower-label">TOTAL NUMBER OF THERAPY SESSIONS:</span>
                  <textarea key={`estimateTotalSessions-${selectedId}`} className="estimate-cost-lower-line auto-grow" rows={1} onInput={autoResize} aria-label="Total number of therapy sessions" value={String(patientFieldValue('estimateTotalSessions'))} onChange={(event) => updatePatientField('estimateTotalSessions', event.target.value)} />
                </div>
                <div className="estimate-cost-lower-row">
                  <span className="estimate-cost-lower-label">PERIOD OF THERAPY SESSIONS:</span>
                  <textarea key={`estimatePeriod-${selectedId}`} className="estimate-cost-lower-line auto-grow" rows={1} onInput={autoResize} aria-label="Period of therapy sessions" value={String(patientFieldValue('estimatePeriod'))} onChange={(event) => updatePatientField('estimatePeriod', event.target.value)} />
                </div>

                <div className="estimate-cost-total-row">
                  <span className="estimate-cost-total-label">TOTAL AMOUNT:</span>
                  <textarea key={`estimateTotalAmount-${selectedId}`} className="estimate-cost-total-line auto-grow" rows={1} onInput={autoResize} aria-label="Total amount" value={String(patientFieldValue('estimateTotalAmount'))} onChange={(event) => updatePatientField('estimateTotalAmount', event.target.value)} />
                </div>

                <div className="estimate-cost-signature-box">
                  <input className="estimate-cost-signature-name" type="text" aria-label="Therapist name" defaultValue="Danila May J. Oledan-Baliton, PTRP" />
                  <div className="estimate-cost-signature-role">PHYSICAL THERAPIST</div>
                  <div className="estimate-cost-signature-license">Lic. No. 23167</div>
                </div>
              </div>
            </div>
          </section>

          <section className="pt-notes-page page-break-page-10" data-print-section="ptNotes">
            <header className="pt-notes-header">
              <div className="document-logo-wrap">
                <img className="document-logo" src={clinicLogo} alt="Clinic logo" />
              </div>
              <div className="pt-notes-branding">
                <h1>BORONGAN PHYSICAL THERAPY CENTER</h1>
                <p>REAL STREET, BARANGAY SONGCO, BORONGAN EASTERN SAMAR</p>
                <p>+639293310697 / +639085982802 / +6392743043238</p>
              </div>
            </header>

            <h2 className="pt-notes-title">PT NOTES</h2>

            <div className="pt-notes-body">
              <textarea
                className="pt-notes-box"
                aria-label="PT notes"
                placeholder="Write session notes, observations, or reminders for this patient here..."
                value={String(patientFieldValue('ptNotes'))}
                onChange={(event) => updatePatientField('ptNotes', event.target.value)}
              />
            </div>
          </section>

          <div className="record-footer"><div><FileText size={16} /><span>Evaluation document</span></div><button className="delete-button" onClick={() => void deletePatient(selectedPatient)}><Trash2 size={15} /> Delete patient</button></div>
        </div> : <div className="welcome-card"><div className="welcome-icon"><Stethoscope size={26} /></div><h2>Select a patient to begin</h2><p>Choose a patient from the list or add a new record to start documenting care.</p><button className="primary-button" onClick={() => setShowPatientModal(true)}><Plus size={16} /> Add new patient</button></div>}
      </main>
      {showPatientModal && <PatientModal patient={editingPatient} onClose={() => { setShowPatientModal(false); setEditingPatient(null); }} onSave={savePatient} onPreviewChange={(draft) => {
        if (!editingPatient) return;
        setPatients((current) => current.map((patient) => patient.id === editingPatient.id ? {
          ...patient,
          name: draft.name || patient.name,
          diagnosis: draft.diagnosis || patient.diagnosis,
          age: draft.age ? Number(draft.age) : patient.age,
          gender: draft.gender || patient.gender,
          phone: draft.phone || patient.phone,
          email: draft.email || patient.email,
          address: draft.address || patient.address,
          nationality: draft.nationality || patient.nationality,
          attending_physician: draft.attending_physician || patient.attending_physician,
          updated_at: new Date().toISOString(),
        } : patient));
      }} />}
    </div>
  );
}

function EvaluationSection({ title, hint, icon, sectionKey, value, onChange }: { title: string; hint: string; icon: string; sectionKey: SectionKey; value: string; onChange: (value: string) => void }) {
  return <section className="evaluation-card" data-print-section={sectionKey}><div className="evaluation-card-header"><div className={`note-icon note-${icon.toLowerCase()}`}>{icon}</div><div><h3>{title}</h3><span>{hint}</span></div><span className="required">Required</span></div><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Document ${title.toLowerCase()} findings…`} /></section>;
}

function PatientModal({ patient, onClose, onSave, onPreviewChange }: { patient: Patient | null; onClose: () => void; onSave: (form: Omit<Patient, 'id' | 'updated_at' | 'status'>) => Promise<void>; onPreviewChange: (draft: { name: string; diagnosis: string; age: string; gender: string; phone: string; email: string; address: string; nationality: string; attending_physician: string; }) => void; }) {
  const [form, setForm] = useState({ name: patient?.name ?? '', diagnosis: patient?.diagnosis ?? '', age: patient?.age?.toString() ?? '', gender: patient?.gender ?? '', phone: patient?.phone ?? '', email: patient?.email ?? '', address: patient?.address ?? '', nationality: patient?.nationality ?? '', attending_physician: patient?.attending_physician ?? '' });
  const [saving, setSaving] = useState(false);
  function update(field: keyof typeof form, value: string) {
    setForm((current) => {
      const nextForm = { ...current, [field]: value };
      onPreviewChange(nextForm);
      return nextForm;
    });
  }
  async function submit(event: React.FormEvent) { event.preventDefault(); if (!form.name.trim()) return; setSaving(true); await onSave({ ...form, name: form.name.trim(), age: form.age ? Number(form.age) : null }); setSaving(false); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={submit}><div className="modal-header"><div><p className="eyebrow">Patient records</p><h2>{patient ? 'Edit patient' : 'Add new patient'}</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="form-grid"><label className="wide">Full name<input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Jordan Lee" /></label><label>Primary diagnosis<input value={form.diagnosis} onChange={(event) => update('diagnosis', event.target.value)} placeholder="e.g. Knee pain" /></label><label>Age<input type="number" min="0" value={form.age} onChange={(event) => update('age', event.target.value)} placeholder="Years" /></label><label>Gender<select value={form.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Select</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></label><label>Nationality<input value={form.nationality} onChange={(event) => update('nationality', event.target.value)} placeholder="e.g. Filipino" /></label><label>Attending physician<input value={form.attending_physician} onChange={(event) => update('attending_physician', event.target.value)} placeholder="e.g. Dr. Smith" /></label><label>Phone<input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="(555) 000-0000" /></label><label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="name@email.com" /></label><label className="wide">Address<input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Street address" /></label></div><div className="modal-footer"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : patient ? 'Save changes' : 'Create patient'}</button></div></form></div>;
}

export default App;