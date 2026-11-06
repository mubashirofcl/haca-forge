import React, { useRef, useState } from 'react';
import { useDialogFocus } from '../../../lib/useDialogFocus';
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
  // Rename / link dialogs: focus in on open, Escape closes, Tab stays inside, focus returns.
  const renameDialogRef = useRef<HTMLDivElement>(null);
  const linkDialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(renameDialogRef, showRenameModal, () => setShowRenameModal(false));
  useDialogFocus(linkDialogRef, showLinkModal, () => setShowLinkModal(false));

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
    <div className="writing-studio-ribbon bg-ui-card/90 backdrop-blur-md border-b border-ui-line select-none">
      {/* 1. Ribbon Tabs Header */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-6 border-b border-ui-line">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
          {(['home', 'insert', 'script', 'review', 'view', 'file'] as RibbonTab[]).map((tab) => (
            <button
              type="button"
              key={tab}
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`min-h-[44px] px-3.5 rounded-full text-[13px] font-semibold capitalize transition-colors whitespace-nowrap ${
                activeTab === tab ? 'bg-ui-ink text-white' : 'text-ui-text hover:text-ui-ink hover:bg-white/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Mobile menu toggle for <= 640px */}
        <div className="sm:hidden flex items-center gap-1">
          <button
           type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ui-icon-btn border-transparent"
            title="Toggle Toolbar Menu"
            aria-label="Toggle toolbar menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Ribbon Tab Content / Toolbar Actions */}
      <div
        className={`${
          mobileMenuOpen ? 'block' : 'hidden sm:flex'
        } p-2 sm:px-6 sm:py-2 flex-wrap items-center gap-2 sm:gap-3 text-ui-text min-h-[56px]`}
      >
        {/* ================= HOME TAB ================= */}
        {activeTab === 'home' && (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
            {/* Undo / Redo */}
            <div className="flex flex-wrap items-center bg-white/60 rounded-ui-control p-0.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Font Family (English + Malayalam: Manjari, Gayathri) */}
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="ui-select text-xs"
              title="Font Family"
              aria-label="Font family"
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
              className="ui-select text-xs"
              title="Paragraph Styles"
              aria-label="Paragraph style"
              defaultValue="p"
            >
              <option value="p">Normal Body</option>
              <option value="h1">Title (Heading 1)</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="quote">Quote Block</option>
            </select>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Inline Formatting: B I U S Sub Sup */}
            <div className="flex flex-wrap items-center bg-white/60 rounded-ui-control p-0.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                aria-pressed={editor.isActive('bold')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('bold') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Bold (Ctrl+B)"
                aria-label="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                aria-pressed={editor.isActive('italic')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('italic') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Italic (Ctrl+I)"
                aria-label="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                aria-pressed={editor.isActive('underline')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('underline') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Underline (Ctrl+U)"
                aria-label="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                aria-pressed={editor.isActive('strike')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('strike') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Strikethrough"
                aria-label="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleSubscript().run()}
                aria-pressed={editor.isActive('subscript')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('subscript') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Subscript"
                aria-label="Subscript"
              >
                <SubscriptIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
                aria-pressed={editor.isActive('superscript')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('superscript') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Superscript"
                aria-label="Superscript"
              >
                <SuperscriptIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Colors: Text color, Highlight */}
            <div className="flex items-center gap-1">
              <label className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors hover:bg-white cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-ui-ink" title="Text Color">
                <span className="text-[13px] font-bold underline decoration-2 decoration-ui-ink" aria-hidden="true">A</span>
                <input
                  type="color"
                  aria-label="Text color"
                  className="opacity-0 w-0 h-0"
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                />
              </label>
              <button
               type="button"
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                aria-pressed={editor.isActive('highlight')}
                aria-label="Highlight background"
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('highlight') ? 'bg-ui-ink' : 'hover:bg-white'
                }`}
                title="Highlight Background"
              >
                <span className="px-1 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900" aria-hidden="true">HL</span>
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors hover:bg-white text-ui-text"
                title="Clear Formatting"
                aria-label="Clear Formatting"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Alignments */}
            <div className="flex flex-wrap items-center bg-white/60 rounded-ui-control p-0.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                aria-pressed={editor.isActive({ textAlign: 'left' })}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive({ textAlign: 'left' }) ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Align Left"
                aria-label="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                aria-pressed={editor.isActive({ textAlign: 'center' })}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive({ textAlign: 'center' }) ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Align Center"
                aria-label="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                aria-pressed={editor.isActive({ textAlign: 'right' })}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive({ textAlign: 'right' }) ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Align Right"
                aria-label="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                aria-pressed={editor.isActive({ textAlign: 'justify' })}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive({ textAlign: 'justify' }) ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Justify"
                aria-label="Justify"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Lists & Checklists */}
            <div className="flex flex-wrap items-center bg-white/60 rounded-ui-control p-0.5">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                aria-pressed={editor.isActive('bulletList')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('bulletList') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Bullet List"
                aria-label="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                aria-pressed={editor.isActive('orderedList')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('orderedList') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Numbered List"
                aria-label="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                aria-pressed={editor.isActive('taskList')}
                className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  editor.isActive('taskList') ? 'bg-ui-ink text-white' : 'hover:bg-white'
                }`}
                title="Interactive Checklist"
                aria-label="Interactive Checklist"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Find & Replace Trigger */}
            <button
              type="button"
              onClick={onOpenFindReplace}
              className="ml-auto ui-btn ui-btn-secondary h-11 gap-1.5"
              title="Find and Replace (Ctrl+F)"
              aria-label="Find and Replace"
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
              type="button"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table (3x3)
            </button>

            {editor.isActive('table') && (
              <div className="flex flex-wrap items-center gap-1 bg-white/60 rounded-ui-control p-0.5">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="min-h-[44px] px-3 text-xs font-semibold text-ui-ink hover:bg-white rounded-lg"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="min-h-[44px] px-3 text-xs font-semibold text-ui-ink hover:bg-white rounded-lg"
                >
                  + Column
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="min-h-[44px] px-3 text-xs font-semibold text-ui-ink hover:bg-white rounded-lg"
                >
                  Del Row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="min-h-[44px] px-3 text-xs font-semibold text-ui-ink hover:bg-white rounded-lg"
                >
                  Del Col
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors text-ui-ink hover:bg-white"
                  title="Delete Table"
                  aria-label="Delete Table"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-ui-line" aria-hidden="true" />

            {/* Image Embed */}
            <button
              type="button"
              onClick={() => {
                const url = prompt('Enter Image URL:');
                if (url) editor.chain().focus().setImage({ src: url }).run();
              }}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Image
            </button>

            {/* Hyperlink */}
            <button
              type="button"
              onClick={() => {
                const prev = editor.getAttributes('link').href || '';
                setLinkUrlInput(prev);
                setShowLinkModal(true);
              }}
              aria-pressed={editor.isActive('link')}
              className={`ui-btn h-11 gap-1.5 ${editor.isActive('link') ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Link
            </button>

            {/* Horizontal Divider */}
            <button
              type="button"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Minus className="w-3.5 h-3.5" />
              Divider
            </button>

            {/* Page Break */}
            <button
              type="button"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .insertContent('<div class="page-break"></div><p></p>')
                  .run()
              }
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
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
                type="button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                aria-expanded={showTemplateDropdown}
                className="ui-btn ui-btn-primary h-11 gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Insert Template
                <ChevronDown className="w-3 h-3 ml-1" />
              </button>

              {showTemplateDropdown && (
                <div className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] glass-modal z-50 p-2 space-y-1">
                  <div className="text-[13px] font-medium text-ui-muted px-2 py-1">
                    Select Production Template
                  </div>
                  {SCRIPT_TEMPLATES.map((tmpl) => (
                    <button
                      type="button"
                      key={tmpl.id}
                      onClick={() => handleInsertTemplate(tmpl.htmlContent)}
                      className="w-full text-left p-2 min-h-[44px] rounded-xl hover:bg-white transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ui-ink">
                          {tmpl.title}
                        </span>
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-ui-text">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-ui-muted line-clamp-1 mt-0.5">{tmpl.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Two-Column Scene Table */}
            <button
              type="button"
              onClick={handleInsertSceneTable}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Scene Table
            </button>

            {/* Launch Teleprompter */}
            <button
              type="button"
              onClick={onOpenTeleprompter}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
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
            <div className="flex flex-wrap items-center gap-2 bg-white/60 rounded-ui-control px-3">
              <label className="text-xs font-semibold text-ui-ink flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={spellcheckEnabled}
                  onChange={(e) => setSpellcheckEnabled(e.target.checked)}
                  className="w-4 h-4 accent-ui-ink"
                />
                Spellcheck
              </label>

              <select
                value={spellcheckLang}
                onChange={(e) => setSpellcheckLang(e.target.value)}
                disabled={!spellcheckEnabled}
                aria-label="Spellcheck language"
                className="ui-select text-xs disabled:opacity-50"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ml">Malayalam (മലയാളം)</option>
              </select>
            </div>

            {/* Version History Trigger */}
            <button
              type="button"
              onClick={onOpenVersionHistory}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              Version History
            </button>

            {/* Comments Sidebar Toggle */}
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-pressed={sidebarOpen}
              className={`ui-btn h-11 gap-1.5 ${sidebarOpen ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
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
            <div className="flex flex-wrap items-center gap-0.5 bg-white/60 rounded-ui-control px-2" role="group" aria-label="Zoom">
              <span className="text-xs font-medium text-ui-muted mr-1">Zoom:</span>
              {[50, 75, 100, 125, 150].map((z) => (
                <button
                  type="button"
                  key={z}
                  aria-pressed={zoom === z}
                  onClick={() => setZoom(z)}
                  className={`min-h-[44px] min-w-[44px] px-2 rounded-lg text-xs font-semibold transition-colors ${
                    zoom === z ? 'bg-ui-ink text-white' : 'text-ui-text hover:bg-white'
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>

            {/* Focus Mode Trigger */}
            <button
              type="button"
              onClick={() => setIsFocusMode(!isFocusMode)}
              aria-pressed={isFocusMode}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Focus Mode
            </button>

            {/* Teleprompter Quick Launch */}
            <button
              type="button"
              onClick={onOpenTeleprompter}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Tv className="w-3.5 h-3.5" />
              Teleprompter
            </button>
          </div>
        )}

        {/* ================= FILE TAB ================= */}
        {activeTab === 'file' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Rename Title */}
            <button
              type="button"
              onClick={() => {
                setNewTitleInput(documentTitle);
                setShowRenameModal(true);
              }}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Rename Document
            </button>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Import DOCX */}
            <button
              type="button"
              onClick={onImportDocx}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Import .docx
            </button>

            {/* Import TXT */}
            <button
              type="button"
              onClick={onImportTxt}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Import .txt
            </button>

            <div className="h-6 w-px bg-ui-line hidden sm:block" aria-hidden="true" />

            {/* Export DOCX */}
            <button
              type="button"
              onClick={onExportDocx}
              className="ui-btn ui-btn-primary h-11 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export .docx
            </button>

            {/* Export PDF through browser print */}
            <button
              type="button"
              onClick={onPrint}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
              title="Exports PDF via native browser print formatted for A4"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>

            {/* Export TXT */}
            <button
              type="button"
              onClick={onExportTxt}
              className="ui-btn ui-btn-secondary h-11 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export .txt
            </button>
          </div>
        )}
      </div>

      {/* Rename Document Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 ui-scrim flex items-center justify-center z-50 p-4">
          <div
            ref={renameDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-rename-title"
            className="glass-modal max-w-md w-full p-6 space-y-4"
          >
            <h3 id="ws-rename-title" className="text-base font-bold text-ui-ink">Rename Document</h3>
            <input
              type="text"
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              aria-label="Document title"
              className="ui-input w-full"
              placeholder="e.g. Fall Tech Showcase - Reel Script"
            />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="ui-btn ui-btn-secondary h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newTitleInput.trim()) {
                    onRenameDocument(newTitleInput.trim());
                    setShowRenameModal(false);
                  }
                }}
                className="ui-btn ui-btn-primary h-11"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Input Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 ui-scrim flex items-center justify-center z-50 p-4">
          <div
            ref={linkDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ws-link-title"
            className="glass-modal max-w-md w-full p-6 space-y-4"
          >
            <h3 id="ws-link-title" className="text-base font-bold text-ui-ink">Insert Hyperlink</h3>
            <input
              type="url"
              value={linkUrlInput}
              onChange={(e) => setLinkUrlInput(e.target.value)}
              aria-label="Link URL"
              className="ui-input w-full"
              placeholder="https://example.com"
            />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="ui-btn ui-btn-secondary h-11"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyLink}
                className="ui-btn ui-btn-primary h-11"
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
