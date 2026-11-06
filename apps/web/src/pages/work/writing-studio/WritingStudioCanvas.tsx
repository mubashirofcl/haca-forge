import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

interface WritingStudioCanvasProps {
  initialContent?: any;
  initialHtml?: string;
  isReadOnly?: boolean;
  zoom: number;
  fontFamily: string;
  spellcheckEnabled: boolean;
  spellcheckLang: string;
  onEditorReady: (editor: any) => void;
  onContentChange: (content: { json: any; html: string; text: string }) => void;
  onManualSave: () => void;
  onOpenFindReplace: () => void;
  onPageCountChange: (count: number) => void;
}

export const WritingStudioCanvas: React.FC<WritingStudioCanvasProps> = ({
  initialContent,
  initialHtml,
  isReadOnly = false,
  zoom,
  fontFamily,
  spellcheckEnabled,
  spellcheckLang,
  onEditorReady,
  onContentChange,
  onManualSave,
  onOpenFindReplace,
  onPageCountChange,
}) => {
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-600 underline font-semibold',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: initialContent || initialHtml || '<p>Start writing your script...</p>',
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class: 'outline-none focus:outline-none min-h-[750px]',
        spellcheck: spellcheckEnabled ? 'true' : 'false',
        lang: spellcheckLang,
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const html = editor.getHTML();
      const text = editor.getText();
      onContentChange({ json, html, text });

      // Approximate page calculation
      if (pageContainerRef.current) {
        const heightPx = pageContainerRef.current.scrollHeight;
        // 297mm standard A4 height is roughly 1123px at 96 DPI
        const calculatedPages = Math.max(1, Math.ceil(heightPx / 1050));
        onPageCountChange(calculatedPages);
      }
    },
  });

  // Notify parent of editor instance
  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Update editable mode if readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isReadOnly);
    }
  }, [editor, isReadOnly]);

  // Keyboard Shortcuts (Ctrl/Cmd + B, I, U, Z, Y, F, S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onManualSave();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onOpenFindReplace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onManualSave, onOpenFindReplace]);

  const getFontFamilyStyle = () => {
    if (fontFamily === 'Manjari') return "'Manjari', 'Plus Jakarta Sans', system-ui, sans-serif";
    if (fontFamily === 'Gayathri') return "'Gayathri', 'Plus Jakarta Sans', system-ui, sans-serif";
    if (fontFamily === 'Inter') return "'Inter', sans-serif";
    if (fontFamily === 'Georgia') return "Georgia, serif";
    if (fontFamily === 'Courier New') return "'Courier New', monospace";
    return "'Plus Jakarta Sans', system-ui, sans-serif";
  };

  return (
    <div className="writing-studio-canvas-container flex-1 min-h-0 overflow-auto bg-ui-canvas-deep/60 p-4 sm:p-8 flex justify-center items-start">
      <div
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease',
        }}
        className="w-full flex justify-center py-4"
      >
        {/* A4 Page Canvas */}
        <div
          ref={pageContainerRef}
          className="a4-page transition-all"
          style={{ fontFamily: getFontFamilyStyle() }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
};
