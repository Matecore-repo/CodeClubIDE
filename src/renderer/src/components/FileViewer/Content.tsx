import { useRef, useEffect } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { loadBreakpoints, toggleBreakpoint } from "../../utils/debugBreakpoints";
import { s } from "./styles";

export function Content({
  isImage,
  imageMime,
  content,
  _original,
  gitOriginal,
  showDiff,
  language,
  filePath,
  workspacePath,
  setContent,
}: {
  isImage: boolean;
  imageMime: string;
  content: string | null;
  _original: string | null;
  gitOriginal: string | null;
  showDiff: boolean;
  language: string;
  filePath: string;
  workspacePath: string | null;
  setContent: (v: string) => void;
}) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decsRef = useRef<any>(null);

  const updateBreakpoints = (editor: any, monaco: any, bps: any[]) => {
    if (!editor || !monaco) return;
    const fileBps = bps.filter((bp: any) => bp.filePath === filePath);
    const newDecs = fileBps.map((bp: any) => ({
      range: new monaco.Range(bp.line, 1, bp.line, 1),
      options: { isWholeLine: false, glyphMarginClassName: "codeclub-breakpoint-glyph" },
    }));
    if (editor.createDecorationsCollection) {
      if (!decsRef.current) decsRef.current = editor.createDecorationsCollection([]);
      decsRef.current.set(newDecs);
    } else {
      decsRef.current = editor.deltaDecorations(decsRef.current || [], newDecs);
    }
  };

  useEffect(() => {
    const handleBps = (e: Event) => {
      updateBreakpoints(editorRef.current, monacoRef.current, (e as CustomEvent).detail);
    };
    window.addEventListener("codeclub:breakpoints", handleBps);
    return () => window.removeEventListener("codeclub:breakpoints", handleBps);
  }, [filePath]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const { line, focus } = (e as CustomEvent<{ line: number; focus?: boolean }>).detail;
      const editor = editorRef.current;
      if (editor) {
        if (editor.getModifiedEditor) {
          const modEditor = editor.getModifiedEditor();
          modEditor.revealLineInCenter(line);
          modEditor.setPosition({ lineNumber: line, column: 1 });
          if (focus) modEditor.focus();
        } else {
          editor.revealLineInCenter(line);
          editor.setPosition({ lineNumber: line, column: 1 });
          if (focus) editor.focus();
        }
      }
    };
    window.addEventListener("codeclub:scroll-to-line", handleScroll);
    return () => window.removeEventListener("codeclub:scroll-to-line", handleScroll);
  }, []);

  if (isImage && content) {
    return (
      <div
        style={{
          ...s.editor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          padding: 20,
        }}
      >
        <img
          src={`data:${imageMime};base64,${content}`}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
          }}
          alt="Preview"
        />
      </div>
    );
  }

  if (showDiff && gitOriginal !== null) {
    return (
      <div style={s.editor}>
        <style>{`
          .codeclub-breakpoint-glyph {
            background: #e51400;
            border-radius: 50%;
            width: 8px !important;
            height: 8px !important;
            margin-left: 7px;
            margin-top: 5px;
          }
        `}</style>
        <DiffEditor
          theme="ide-theme"
          language={language}
          original={gitOriginal}
          modified={content || ""}
          keepCurrentModifiedModel={true}
          keepCurrentOriginalModel={true}
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            renderOverviewRuler: false,
            fontSize: 13,
            fontFamily: "var(--font-family-mono)",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
              vertical: "visible",
              horizontal: "visible",
              useShadows: false,
            },
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monaco.editor.defineTheme("ide-theme", {
              base: "vs-dark",
              inherit: true,
              rules: [],
              colors: {
                "editor.background": "#101010",
                "editorWidget.background": "#121212",
                "editorWidget.border": "rgba(255, 255, 255, 0.15)",
                "input.background": "rgba(255, 255, 255, 0.05)",
                "input.foreground": "#ffffff",
                "input.border": "rgba(255, 255, 255, 0.1)",
                "input.placeholderForeground": "#999999",
                focusBorder: "#00000000",
                "inputValidation.errorBackground": "#121212",
                "inputValidation.errorBorder": "rgba(255, 255, 255, 0.15)",
                "inputValidation.warningBackground": "#121212",
                "inputValidation.warningBorder": "rgba(255, 255, 255, 0.15)",
                "inputValidation.infoBackground": "#121212",
                "inputValidation.infoBorder": "rgba(255, 255, 255, 0.15)",
              },
            });
            monaco.editor.setTheme("ide-theme");

            // Explicitly disable minimap on both editors
            editor.getOriginalEditor().updateOptions({ minimap: { enabled: false } });
            editor.getModifiedEditor().updateOptions({ minimap: { enabled: false } });

            // Intercept Ctrl+F to trigger custom search
            editor
              .getModifiedEditor()
              .addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
                window.dispatchEvent(new CustomEvent("codeclub:trigger-find"));
              });
            editor
              .getOriginalEditor()
              .addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
                window.dispatchEvent(new CustomEvent("codeclub:trigger-find"));
              });

            // Intercept Escape to blur
            editor.getModifiedEditor().addCommand(monaco.KeyCode.Escape, () => {
              const activeEl = document.activeElement as HTMLElement;
              if (activeEl) activeEl.blur();
            });
            editor.getOriginalEditor().addCommand(monaco.KeyCode.Escape, () => {
              const activeEl = document.activeElement as HTMLElement;
              if (activeEl) activeEl.blur();
            });

            // Intercept and disable F1-F12 (Command Palette, rename, etc)
            for (let f = monaco.KeyCode.F1; f <= monaco.KeyCode.F12; f++) {
              editor.getModifiedEditor().addCommand(f, () => {});
              editor.getOriginalEditor().addCommand(f, () => {});
            }
          }}
        />
      </div>
    );
  }

  return (
    <div style={s.editor}>
      <style>{`
        .codeclub-breakpoint-glyph {
          background: #e51400;
          border-radius: 50%;
          width: 8px !important;
          height: 8px !important;
          margin-left: 7px;
          margin-top: 5px;
        }
      `}</style>
      <Editor
        theme="ide-theme"
        language={language}
        keepCurrentModel={true}
        path={filePath}
        value={content || ""}
        onChange={(v) => setContent(v || "")}
        onMount={(editor, monaco) => {
          editorRef.current = editor;
          monaco.editor.defineTheme("ide-theme", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#101010",
              "editorWidget.background": "#121212",
              "editorWidget.border": "rgba(255, 255, 255, 0.15)",
              "input.background": "rgba(255, 255, 255, 0.05)",
              "input.foreground": "#ffffff",
              "input.border": "rgba(255, 255, 255, 0.1)",
              "input.placeholderForeground": "#999999",
              focusBorder: "#00000000",
              "inputValidation.errorBackground": "#121212",
              "inputValidation.errorBorder": "rgba(255, 255, 255, 0.15)",
              "inputValidation.warningBackground": "#121212",
              "inputValidation.warningBorder": "rgba(255, 255, 255, 0.15)",
              "inputValidation.infoBackground": "#121212",
              "inputValidation.infoBorder": "rgba(255, 255, 255, 0.15)",
            },
          });
          monaco.editor.setTheme("ide-theme");
          monacoRef.current = monaco;
          if (workspacePath) {
            updateBreakpoints(editor, monaco, loadBreakpoints(workspacePath));
          }
          editor.onMouseDown((e) => {
            if (e.target.type === 2 && workspacePath) {
              const line = e.target.position?.lineNumber;
              if (line) toggleBreakpoint(workspacePath, filePath, line);
            }
          });

          // Intercept Ctrl+B to toggle breakpoint
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
            if (workspacePath) {
              const line = editor.getPosition()?.lineNumber;
              if (line) toggleBreakpoint(workspacePath, filePath, line);
            }
          });

          // Intercept Ctrl+F to trigger custom search
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
            window.dispatchEvent(new CustomEvent("codeclub:trigger-find"));
          });

          // Intercept Escape to blur
          editor.addCommand(monaco.KeyCode.Escape, () => {
            const activeEl = document.activeElement as HTMLElement;
            if (activeEl) activeEl.blur();
          });

          // Intercept and disable F1-F12 (Command Palette, rename, etc)
          for (let f = monaco.KeyCode.F1; f <= monaco.KeyCode.F12; f++) {
            editor.addCommand(f, () => {});
          }
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "var(--font-family-mono)",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 10 },
          glyphMargin: true,
          lineNumbersMinChars: 3,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            vertical: "visible",
            horizontal: "visible",
            useShadows: false,
          },
        }}
      />
    </div>
  );
}
