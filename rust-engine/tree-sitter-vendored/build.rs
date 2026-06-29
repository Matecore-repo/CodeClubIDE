use std::path::PathBuf;
use std::env;

fn main() {
    let grammars_dir = PathBuf::from("grammars");
    
    let langs: Vec<&str> = vec!["ada", "agda", "apex", "assembly", "astro", "awk", "bash", "beancount", "bibtex", "bicep", "bitbake", "blade", "c", "c_sharp", "cairo", "capnp", "cfml", "cfscript", "clojure", "cmake", "commonlisp", "cpp", "crystal", "css", "csv", "cuda", "d", "dart", "devicetree", "diff", "dockerfile", "dotenv", "elisp", "elixir", "elm", "erlang", "fennel", "fish", "form", "fortran", "fsharp", "func", "gdscript", "gitattributes", "gitignore", "gleam", "glsl", "gn", "go", "gomod", "gotemplate", "graphql", "groovy", "hare", "haskell", "hcl", "hlsl", "html", "hyprlang", "ini", "ispc", "janet", "java", "javascript", "jinja2", "jsdoc", "json", "json5", "jsonnet", "julia", "just", "kconfig", "kdl", "kotlin", "lean", "linkerscript", "liquid", "llvm", "lua", "luau", "magma", "make", "markdown", "matlab", "mermaid", "meson", "move", "nasm", "nickel", "nix", "objc", "objectscript_routine", "objectscript_udl", "ocaml", "odin", "pascal", "perl", "php", "pine", "pkl", "po", "pony", "powershell", "prisma", "properties", "protobuf", "puppet", "purescript", "python", "qml", "r", "racket", "regex", "requirements", "rescript", "ron", "rst", "ruby", "rust", "scala", "scheme", "scss", "slang", "smali", "smithy", "solidity", "soql", "sosl", "sql", "squirrel", "sshconfig", "starlark", "svelte", "sway", "swift", "systemverilog", "tablegen", "tcl", "teal", "templ", "thrift", "tlaplus", "toml", "tsx", "typescript", "typst", "verilog", "vhdl", "vim", "vue", "wgsl", "wit", "wolfram", "xml", "yaml", "zig", "zsh"];

    
    for lang in langs {
        let lang_dir = grammars_dir.join(lang);
        let parser = lang_dir.join("parser.c");
        
        if parser.exists() {
            let mut build = cc::Build::new();
            build.include(&grammars_dir);
            // Some grammars use C99 or require standard libraries
            build.warnings(false);
            build.file(&parser);
            
            let scanner_c = lang_dir.join("scanner.c");
            if scanner_c.exists() {
                build.file(&scanner_c);
            }
            build.compile(&format!("tree_sitter_{}_c", lang));
        }
        
        let scanner_cc = lang_dir.join("scanner.cc");
        if scanner_cc.exists() {
            let mut cpp_build = cc::Build::new();
            cpp_build.cpp(true).warnings(false).include(&grammars_dir).file(&scanner_cc);
            cpp_build.compile(&format!("tree_sitter_{}_scanner_cc", lang));
        }
        
        let scanner_cxx = lang_dir.join("scanner.cxx");
        if scanner_cxx.exists() {
            let mut cpp_build = cc::Build::new();
            cpp_build.cpp(true).warnings(false).include(&grammars_dir).file(&scanner_cxx);
            cpp_build.compile(&format!("tree_sitter_{}_scanner_cxx", lang));
        }
    }
}
