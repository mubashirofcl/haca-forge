import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  Scissors,
  FileText,
  Search,
  Maximize2,
  Tv,
  Printer,
  Download,
  Upload,
  Sparkles,
  History,
  MessageSquare,
  Trash2,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { SCRIPT_TEMPLATES } from '../../../lib/scriptTools';

export type RibbonTab = 'home' | 'insert' | 'script' | 'review' | 'view' | 'file';

interface WritingStudioRibbonProps {
  editor: Editor | null;
  activeTab: RibbonTab;
  setActiveTab: (tab: RibbonTab) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isFocusMode: boolean;
  setIsFocusMode: (focus: boolean) => void;
  onOpenVersionHistory: () => void;
  onOpenTeleprompter: () => void;
  onOpenFindReplace: () => void;
  onExportDocx: () => void;
  onImportDocx: () => void;
  onExportTxt: () => void;
  onImportTxt: () => void;
  onPrint: () => void;
  documentTitle: string;
  onRenameDocument: (newTitle: string) => void;
  spellcheckLang: string;
  setSpellcheckLang: (lang: string) => void;
  spellcheckEnabled: boolean;
  setSpellcheckEnabled: (enabled: boolean) => void;
  commentsCount: number;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  fontFamily: string;
  setFontFamily: (font: string) => void;
}

export const WritingStudioRibbon: React.FC<WritingStudioRibbonProps> = ({
  editor,
  activeTab,
  setActiveTab,
  zoom,
  setZoom,
  isFocusMode,
  setIsFocusMode,
  onOpenVersionHistory,
  onOpenTeleprompter,
  onOpenFindReplace,
  onExportDocx,
  onImportDocx,
  onExportTxt,
  onImportTxt,
  onPrint,
  documentTitle,
  onRenameDocument,
  spellcheckLang,
  setSpellcheckLang,
  spellcheckEnabled,
  setSpellcheckEnabled,
  commentsCount,
  onToggleSidebar,
  sidebarOpen,
  fontFamily,
  setFontFamily,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTitleInput, setNewTitleInput] = useState(documentTitle);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  if (!editor) return null;

  // Insert structured scene table helper
  const handleInsertSceneTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 4, cols: 4, withHeaderRow: true })
      .run();
  };

  const handleApplyLink = () => {
    if (!linkUrlInput.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: linkUrlInput.trim() }).run();
    }
    setShowLinkModal(false);
    setLinkUrlInput('');
  };

  const handleInsertTemplate = (templateHtml: string) => {
    editor.chain().focus().setContent(templateHtml).run();
    setShowTemplateDropdown(false);
  };

  return (
    <div className="writing-studio-ribbon bg-white/90 backdrop-blur-md border-b border-slate-200/90 shadow-xs select-none">
      {/* 1. Ribbon Tabs Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 border-b border-slate-100">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {(['home', 'insert', 'script', 'review', 'view', 'file'] as RibbonTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mobile menu toggle for <= 640px */}
        <div className="sm:hidden flex items-center gap-1">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
            title="Toggle Toolbar Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Ribbon Tab Content / Toolbar Actions */}
      <div
        className={`${
          mobileMenuOpen ? 'block' : 'hidden sm:flex'
        } p-2 sm:px-6 sm:py-2.5 flex-wrap items-center gap-2 sm:gap-3 text-slate-700 min-h-[52px]`}
      >
        {/* ================= HOME TAB ================= */}
        {activeTab === 'home' && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
            {/* Undo / Redo */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Font Family (English + Malayalam: Manjari, Gayathri) */}
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="Font Family"
            >
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Manjari">Manjari (മലയാളം)</option>
              <option value="Gayathri">Gayathri (മലയാളം)</option>
              <option value="Inter">Inter</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New (Monospace)</option>
            </select>

            {/* Paragraph Styles Dropdown */}
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'p') editor.chain().focus().setParagraph().run();
                if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
                if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
                if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
                if (val === 'quote') editor.chain().focus().toggleBlockquote().run();
              }}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-800 hover:border-slate-300 focus:outline-none"
              title="Paragraph Styles"
              defaultValue="p"
            >
              <option value="p">Normal Body</option>
              <option value="h1">Title (Heading 1)</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="quote">Quote Block</option>
            </select>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Inline Formatting: B I U S Sub Sup */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('bold') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('italic') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('underline') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('strike') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('subscript') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Subscript"
              >
                <SubscriptIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('superscript') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Superscript"
              >
                <SuperscriptIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Colors: Text color, Highlight */}
            <div className="flex items-center gap-1">
              <label className="p-1.5 rounded hover:bg-slate-100 cursor-pointer flex items-center" title="Text Color">
                <span className="text-[11px] font-black underline decoration-2 decoration-indigo-600">A</span>
                <input
                  type="color"
                  className="opacity-0 w-0 h-0"
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                />
              </label>
              <button
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                className={`p-1.5 rounded hover:bg-slate-100 transition-all ${
                  editor.isActive('highlight') ? 'bg-amber-100 text-amber-900' : ''
                }`}
                title="Highlight Background"
              >
                <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">HL</span>
              </button>
              <button
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                title="Clear Formatting"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Alignments */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive({ textAlign: 'left' }) ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive({ textAlign: 'center' }) ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive({ textAlign: 'right' }) ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive({ textAlign: 'justify' }) ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Justify"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Lists & Checklists */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('bulletList') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('orderedList') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded hover:bg-white transition-all ${
                  editor.isActive('taskList') ? 'bg-white text-indigo-600 shadow-xs' : ''
                }`}
                title="Interactive Checklist"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Find & Replace Trigger */}
            <button
              onClick={onOpenFindReplace}
              className="ml-auto px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Find and Replace (Ctrl+F)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Find & Replace</span>
            </button>
          </div>
        )}

        {/* ================= INSERT TAB ================= */}
        {activeTab === 'insert' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Table Operations */}
            <button
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              Table (3x3)
            </button>

            {editor.isActive('table') && (
              <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-lg p-1">
                <button
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 rounded"
                >
                  + Row
                </button>
                <button
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 rounded"
                >
                  + Column
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 rounded"
                >
                  Del Row
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 rounded"
                >
                  Del Col
                </button>
                <button
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="p-1 text-rose-600 hover:bg-rose-100 rounded"
                  title="Delete Table"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="h-5 w-px bg-slate-200" />

            {/* Image Embed */}
            <button
              onClick={() => {
                const url = prompt('Enter Image URL:');
                if (url) editor.chain().focus().setImage({ src: url }).run();
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
              Image
            </button>

            {/* Hyperlink */}
            <button
              onClick={() => {
                const prev = editor.getAttributes('link').href || '';
                setLinkUrlInput(prev);
                setShowLinkModal(true);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                editor.isActive('link') ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
              Link
            </button>

            {/* Horizontal Divider */}
            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
              Divider
            </button>

            {/* Page Break */}
            <button
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertContent('<div class="page-break"></div><p></p>')
                  .run()
              }
              className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Page Break
            </button>
          </div>
        )}

        {/* ================= SCRIPT TAB ================= */}
        {activeTab === 'script' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Script Templates Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Insert Template
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2 space-y-1">
                  <div className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                    Select Production Template
                  </div>
                  {SCRIPT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => handleInsertTemplate(tmpl.htmlContent)}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                          {tmpl.title}
                        </span>
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{tmpl.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Two-Column Scene Table */}
            <button
              onClick={handleInsertSceneTable}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <TableIcon className="w-3.5 h-3.5 text-yellow-400" />
              Scene Table
            </button>

            {/* Launch Teleprompter */}
            <button
              onClick={onOpenTeleprompter}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5" />
              Teleprompter
            </button>
          </div>
        )}

        {/* ================= REVIEW TAB ================= */}
        {activeTab === 'review' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Spellcheck & Language */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-2.5 py-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={spellcheckEnabled}
                  onChange={(e) => setSpellcheckEnabled(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Spellcheck
              </label>

              <select
                value={spellcheckLang}
                onChange={(e) => setSpellcheckLang(e.target.value)}
                disabled={!spellcheckEnabled}
                className="text-xs font-semibold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 disabled:opacity-50"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ml">Malayalam (മലയാളം)</option>
              </select>
            </div>

            {/* Version History Trigger */}
            <button
              onClick={onOpenVersionHistory}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              Version History
            </button>

            {/* Comments Sidebar Toggle */}
            <button
              onClick={onToggleSidebar}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                sidebarOpen ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comments ({commentsCount})
            </button>
          </div>
        )}

        {/* ================= VIEW TAB ================= */}
        {activeTab === 'view' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Zoom Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2 py-1">
              <span className="text-[11px] font-bold text-slate-500">Zoom:</span>
              {[50, 75, 100, 125, 150].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`px-2 py-0.5 rounded text-xs font-extrabold cursor-pointer transition-colors ${
                    zoom === z ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>

            {/* Focus Mode Trigger */}
            <button
              onClick={() => setIsFocusMode(!isFocusMode)}
              className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
              Focus Mode
            </button>

            {/* Teleprompter Quick Launch */}
            <button
              onClick={onOpenTeleprompter}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5 text-amber-600" />
              Teleprompter
            </button>
          </div>
        )}

        {/* ================= FILE TAB ================= */}
        {activeTab === 'file' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Rename Title */}
            <button
              onClick={() => {
                setNewTitleInput(documentTitle);
                setShowRenameModal(true);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              Rename Document
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Import DOCX */}
            <button
              onClick={onImportDocx}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              Import .docx
            </button>

            {/* Import TXT */}
            <button
              onClick={onImportTxt}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              Import .txt
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Export DOCX */}
            <button
              onClick={onExportDocx}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export .docx
            </button>

            {/* Export PDF through browser print */}
            <button
              onClick={onPrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Exports PDF via native browser print formatted for A4"
            >
              <Printer className="w-3.5 h-3.5 text-yellow-400" />
              Print / Save as PDF
            </button>

            {/* Export TXT */}
            <button
              onClick={onExportTxt}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              Export .txt
            </button>
          </div>
        )}
      </div>

      {/* Rename Document Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Rename Document</h3>
            <input
              type="text"
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              className="w-full text-sm font-semibold border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Fall Tech Showcase - Reel Script"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newTitleInput.trim()) {
                    onRenameDocument(newTitleInput.trim());
                    setShowRenameModal(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Input Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Insert Hyperlink</h3>
            <input
              type="url"
              value={linkUrlInput}
              onChange={(e) => setLinkUrlInput(e.target.value)}
              className="w-full text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLink}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
              >
                Apply Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
