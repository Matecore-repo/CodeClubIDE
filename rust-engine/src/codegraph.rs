use tree_sitter::{Node, Parser};

#[derive(Debug, Clone)]
pub struct SymbolRange {
    pub start_line: usize,
    pub end_line: usize,
    pub kind: String,
    pub name: Option<String>,
}

pub fn extract_tree_sitter_ranges(ext: &str, content: &str) -> Vec<SymbolRange> {
    let language = match ext {
        "c" | "h" => tree_sitter_vendored::language_c(),
        "cc" | "cpp" | "cxx" | "hpp" | "hh" | "hxx" => tree_sitter_vendored::language_cpp(),
        "cs" => tree_sitter_vendored::language_c_sharp(),
        "dart" => tree_sitter_vendored::language_dart(),
        "ex" | "exs" => tree_sitter_vendored::language_elixir(),
        "fs" | "fsx" | "fsi" => tree_sitter_vendored::language_fsharp(),
        "go" => tree_sitter_vendored::language_go(),
        "java" => tree_sitter_vendored::language_java(),
        "js" | "jsx" | "mjs" | "cjs" => tree_sitter_vendored::language_javascript(),
        "kt" | "kts" => tree_sitter_vendored::language_kotlin(),
        "lua" => tree_sitter_vendored::language_lua(),
        "ml" | "mli" => tree_sitter_vendored::language_ocaml(),
        "pas" | "pp" => tree_sitter_vendored::language_pascal(),
        "pl" | "pm" => tree_sitter_vendored::language_perl(),
        "ts" | "mts" | "cts" => tree_sitter_vendored::language_typescript(),
        "tsx" => tree_sitter_vendored::language_tsx(),
        "py" | "pyw" => tree_sitter_vendored::language_python(),
        "r" => tree_sitter_vendored::language_r(),
        "rs" => tree_sitter_vendored::language_rust(),
        "rb" => tree_sitter_vendored::language_ruby(),
        "php" => tree_sitter_vendored::language_php(),
        "scala" | "sc" => tree_sitter_vendored::language_scala(),
        "sol" => tree_sitter_vendored::language_solidity(),
        "swift" => tree_sitter_vendored::language_swift(),
        "vue" => tree_sitter_vendored::language_vue(),
        "zig" => tree_sitter_vendored::language_zig(),
        "html" | "htm" => tree_sitter_vendored::language_html(),
        "css" => tree_sitter_vendored::language_css(),
        "json" => tree_sitter_vendored::language_json(),
        "sh" | "bash" => tree_sitter_vendored::language_bash(),
        "yaml" | "yml" => tree_sitter_vendored::language_yaml(),
        "toml" => tree_sitter_vendored::language_toml(),
        "md" | "markdown" => tree_sitter_vendored::language_markdown(),
        _ => return Vec::new(),
    };

    let mut parser = Parser::new();
    if parser.set_language(&language).is_err() {
        return Vec::new();
    }
    let Some(tree) = parser.parse(content, None) else {
        return Vec::new();
    };

    let bytes = content.as_bytes();
    let mut out = Vec::new();
    visit(tree.root_node(), bytes, &mut out);
    out.sort_by_key(|range| range.start_line);
    out
}

fn visit(node: Node, bytes: &[u8], out: &mut Vec<SymbolRange>) {
    if matches!(
        node.kind(),
        "function_definition"
            | "class_specifier"
            | "struct_specifier"
            | "function_declaration"
            | "function"
            | "function_item"
            | "function_statement"
            | "method_definition"
            | "method_declaration"
            | "method"
            | "constructor_declaration"
            | "class_declaration"
            | "class_definition"
            | "interface_declaration"
            | "lexical_declaration"
            | "impl_item"
            | "struct_item"
            | "enum_item"
            | "trait_item"
            | "object_declaration"
            | "type_declaration"
            | "type_alias_declaration"
            | "variable_declaration"
            | "const_declaration"
    ) {
        if let Some(name) = node_name(node, bytes) {
            out.push(SymbolRange {
                start_line: node.start_position().row + 1,
                end_line: node.end_position().row + 1,
                kind: node_kind(node.kind()).to_string(),
                name: Some(name),
            });
        }
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        visit(child, bytes, out);
    }
}

fn node_kind(kind: &str) -> &str {
    match kind {
        "class_specifier" => "class",
        "class_declaration" => "class",
        "class_definition" => "class",
        "interface_declaration" => "interface",
        "struct_specifier" => "struct",
        "struct_item" => "struct",
        "enum_item" => "enum",
        "trait_item" => "trait",
        "impl_item" => "impl",
        "object_declaration" => "class",
        "method_definition" => "method",
        "method_declaration" => "method",
        "method" => "method",
        "constructor_declaration" => "method",
        "lexical_declaration" => "variable",
        "variable_declaration" => "variable",
        "const_declaration" => "variable",
        "type_declaration" => "type",
        "type_alias_declaration" => "type",
        _ => "function",
    }
}

fn node_name(node: Node, bytes: &[u8]) -> Option<String> {
    if node.kind() == "method_declaration" {
        if let Some(name) = descendant_text(node, bytes, "field_identifier") {
            return Some(name);
        }
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "identifier"
            || child.kind() == "type_identifier"
            || child.kind() == "property_identifier"
            || child.kind() == "field_identifier"
        {
            return child.utf8_text(bytes).ok().map(str::to_string);
        }
        if child.kind() == "function_declarator" {
            if let Some(name) = node_name(child, bytes) {
                return Some(name);
            }
        }
        if child.kind() == "variable_declarator" {
            if let Some(name) = node_name(child, bytes) {
                return Some(name);
            }
        }
        if let Some(name) = node_name(child, bytes) {
            return Some(name);
        }
    }
    None
}

fn descendant_text(node: Node, bytes: &[u8], kind: &str) -> Option<String> {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == kind {
            return child.utf8_text(bytes).ok().map(str::to_string);
        }
        if let Some(text) = descendant_text(child, bytes, kind) {
            return Some(text);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_cpp_symbols() {
        let code = r#"
class World {
public:
  void tick();
};

int main() {
  return 0;
}
"#;
        let ranges = extract_tree_sitter_ranges("cpp", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"World"));
        assert!(names.contains(&"main"));
    }

    #[test]
    fn extracts_typescript_symbols() {
        let code = r#"
interface Project {}
class Runner {
  start() {}
}
function searchIndex() {}
const helper = () => {};
"#;
        let ranges = extract_tree_sitter_ranges("ts", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"Project"));
        assert!(names.contains(&"Runner"));
        assert!(names.contains(&"start"));
        assert!(names.contains(&"searchIndex"));
        assert!(names.contains(&"helper"));
    }

    #[test]
    fn extracts_python_symbols() {
        let code = r#"
class Worker:
    def run(self):
        pass

def build_index():
    pass
"#;
        let ranges = extract_tree_sitter_ranges("py", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"Worker"));
        assert!(names.contains(&"run"));
        assert!(names.contains(&"build_index"));
    }

    #[test]
    fn extracts_rust_symbols() {
        let code = r#"
struct Engine {}
impl Engine {
    fn run(&self) {}
}
fn build_index() {}
"#;
        let ranges = extract_tree_sitter_ranges("rs", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"Engine"));
        assert!(names.contains(&"run"));
        assert!(names.contains(&"build_index"));
    }

    #[test]
    fn extracts_go_symbols() {
        let code = r#"
type Server struct {}
func (s *Server) Run() {}
func BuildIndex() {}
"#;
        let ranges = extract_tree_sitter_ranges("go", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"Server"));
        assert!(names.contains(&"Run"));
        assert!(names.contains(&"BuildIndex"));
    }

    #[test]
    fn extracts_java_symbols() {
        let code = r#"
class Service {
    void start() {}
}
"#;
        let ranges = extract_tree_sitter_ranges("java", code);
        let names: Vec<_> = ranges.iter().filter_map(|range| range.name.as_deref()).collect();
        assert!(names.contains(&"Service"));
        assert!(names.contains(&"start"));
    }
}
