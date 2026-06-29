use tree_sitter::Language;

extern "C" {
    fn tree_sitter_ada() -> *const ();
    fn tree_sitter_agda() -> *const ();
    fn tree_sitter_apex() -> *const ();
    fn tree_sitter_asm() -> *const ();
    fn tree_sitter_astro() -> *const ();
    fn tree_sitter_awk() -> *const ();
    fn tree_sitter_bash() -> *const ();
    fn tree_sitter_beancount() -> *const ();
    fn tree_sitter_bibtex() -> *const ();
    fn tree_sitter_bicep() -> *const ();
    fn tree_sitter_bitbake() -> *const ();
    fn tree_sitter_blade() -> *const ();
    fn tree_sitter_c() -> *const ();
    fn tree_sitter_cairo() -> *const ();
    fn tree_sitter_capnp() -> *const ();
    fn tree_sitter_cfml() -> *const ();
    fn tree_sitter_cfscript() -> *const ();
    fn tree_sitter_clojure() -> *const ();
    fn tree_sitter_cmake() -> *const ();
    fn tree_sitter_commonlisp() -> *const ();
    fn tree_sitter_cpp() -> *const ();
    fn tree_sitter_crystal() -> *const ();
    fn tree_sitter_css() -> *const ();
    fn tree_sitter_csv() -> *const ();
    fn tree_sitter_cuda() -> *const ();
    fn tree_sitter_c_sharp() -> *const ();
    fn tree_sitter_d() -> *const ();
    fn tree_sitter_dart() -> *const ();
    fn tree_sitter_devicetree() -> *const ();
    fn tree_sitter_diff() -> *const ();
    fn tree_sitter_dockerfile() -> *const ();
    fn tree_sitter_dotenv() -> *const ();
    fn tree_sitter_elisp() -> *const ();
    fn tree_sitter_elixir() -> *const ();
    fn tree_sitter_elm() -> *const ();
    fn tree_sitter_erlang() -> *const ();
    fn tree_sitter_fennel() -> *const ();
    fn tree_sitter_fish() -> *const ();
    fn tree_sitter_form() -> *const ();
    fn tree_sitter_fortran() -> *const ();
    fn tree_sitter_fsharp() -> *const ();
    fn tree_sitter_func() -> *const ();
    fn tree_sitter_gdscript() -> *const ();
    fn tree_sitter_gitattributes() -> *const ();
    fn tree_sitter_gitignore() -> *const ();
    fn tree_sitter_gleam() -> *const ();
    fn tree_sitter_glsl() -> *const ();
    fn tree_sitter_gn() -> *const ();
    fn tree_sitter_go() -> *const ();
    fn tree_sitter_gomod() -> *const ();
    fn tree_sitter_gotmpl() -> *const ();
    fn tree_sitter_graphql() -> *const ();
    fn tree_sitter_groovy() -> *const ();
    fn tree_sitter_hare() -> *const ();
    fn tree_sitter_haskell() -> *const ();
    fn tree_sitter_hcl() -> *const ();
    fn tree_sitter_hlsl() -> *const ();
    fn tree_sitter_html() -> *const ();
    fn tree_sitter_hyprlang() -> *const ();
    fn tree_sitter_ini() -> *const ();
    fn tree_sitter_ispc() -> *const ();
    fn tree_sitter_janet_simple() -> *const ();
    fn tree_sitter_java() -> *const ();
    fn tree_sitter_javascript() -> *const ();
    fn tree_sitter_jinja2() -> *const ();
    fn tree_sitter_jsdoc() -> *const ();
    fn tree_sitter_json() -> *const ();
    fn tree_sitter_json5() -> *const ();
    fn tree_sitter_jsonnet() -> *const ();
    fn tree_sitter_julia() -> *const ();
    fn tree_sitter_just() -> *const ();
    fn tree_sitter_kconfig() -> *const ();
    fn tree_sitter_kdl() -> *const ();
    fn tree_sitter_kotlin() -> *const ();
    fn tree_sitter_lean() -> *const ();
    fn tree_sitter_linkerscript() -> *const ();
    fn tree_sitter_liquid() -> *const ();
    fn tree_sitter_llvm() -> *const ();
    fn tree_sitter_lua() -> *const ();
    fn tree_sitter_luau() -> *const ();
    fn tree_sitter_magma() -> *const ();
    fn tree_sitter_make() -> *const ();
    fn tree_sitter_markdown() -> *const ();
    fn tree_sitter_matlab() -> *const ();
    fn tree_sitter_mermaid() -> *const ();
    fn tree_sitter_meson() -> *const ();
    fn tree_sitter_move() -> *const ();
    fn tree_sitter_nasm() -> *const ();
    fn tree_sitter_nickel() -> *const ();
    fn tree_sitter_nix() -> *const ();
    fn tree_sitter_objc() -> *const ();
    fn tree_sitter_objectscript_routine() -> *const ();
    fn tree_sitter_objectscript_udl() -> *const ();
    fn tree_sitter_ocaml() -> *const ();
    fn tree_sitter_odin() -> *const ();
    fn tree_sitter_pascal() -> *const ();
    fn tree_sitter_perl() -> *const ();
    fn tree_sitter_php_only() -> *const ();
    fn tree_sitter_pine() -> *const ();
    fn tree_sitter_pkl() -> *const ();
    fn tree_sitter_po() -> *const ();
    fn tree_sitter_pony() -> *const ();
    fn tree_sitter_powershell() -> *const ();
    fn tree_sitter_prisma() -> *const ();
    fn tree_sitter_properties() -> *const ();
    fn tree_sitter_proto() -> *const ();
    fn tree_sitter_puppet() -> *const ();
    fn tree_sitter_purescript() -> *const ();
    fn tree_sitter_python() -> *const ();
    fn tree_sitter_qmljs() -> *const ();
    fn tree_sitter_r() -> *const ();
    fn tree_sitter_racket() -> *const ();
    fn tree_sitter_regex() -> *const ();
    fn tree_sitter_requirements() -> *const ();
    fn tree_sitter_rescript() -> *const ();
    fn tree_sitter_ron() -> *const ();
    fn tree_sitter_rst() -> *const ();
    fn tree_sitter_ruby() -> *const ();
    fn tree_sitter_rust() -> *const ();
    fn tree_sitter_scala() -> *const ();
    fn tree_sitter_scheme() -> *const ();
    fn tree_sitter_scss() -> *const ();
    fn tree_sitter_slang() -> *const ();
    fn tree_sitter_smali() -> *const ();
    fn tree_sitter_smithy() -> *const ();
    fn tree_sitter_solidity() -> *const ();
    fn tree_sitter_soql() -> *const ();
    fn tree_sitter_sosl() -> *const ();
    fn tree_sitter_sql() -> *const ();
    fn tree_sitter_squirrel() -> *const ();
    fn tree_sitter_ssh_config() -> *const ();
    fn tree_sitter_starlark() -> *const ();
    fn tree_sitter_svelte() -> *const ();
    fn tree_sitter_sway() -> *const ();
    fn tree_sitter_swift() -> *const ();
    fn tree_sitter_systemverilog() -> *const ();
    fn tree_sitter_tablegen() -> *const ();
    fn tree_sitter_tcl() -> *const ();
    fn tree_sitter_teal() -> *const ();
    fn tree_sitter_templ() -> *const ();
    fn tree_sitter_thrift() -> *const ();
    fn tree_sitter_tlaplus() -> *const ();
    fn tree_sitter_toml() -> *const ();
    fn tree_sitter_tsx() -> *const ();
    fn tree_sitter_typescript() -> *const ();
    fn tree_sitter_typst() -> *const ();
    fn tree_sitter_verilog() -> *const ();
    fn tree_sitter_vhdl() -> *const ();
    fn tree_sitter_vim() -> *const ();
    fn tree_sitter_vue() -> *const ();
    fn tree_sitter_wgsl() -> *const ();
    fn tree_sitter_wit() -> *const ();
    fn tree_sitter_wolfram() -> *const ();
    fn tree_sitter_xml() -> *const ();
    fn tree_sitter_yaml() -> *const ();
    fn tree_sitter_zig() -> *const ();
    fn tree_sitter_zsh() -> *const ();
}

pub fn language_ada() -> Language {
    unsafe { Language::from_raw(tree_sitter_ada() as _) }
}

pub fn language_agda() -> Language {
    unsafe { Language::from_raw(tree_sitter_agda() as _) }
}

pub fn language_apex() -> Language {
    unsafe { Language::from_raw(tree_sitter_apex() as _) }
}

pub fn language_assembly() -> Language {
    unsafe { Language::from_raw(tree_sitter_asm() as _) }
}

pub fn language_astro() -> Language {
    unsafe { Language::from_raw(tree_sitter_astro() as _) }
}

pub fn language_awk() -> Language {
    unsafe { Language::from_raw(tree_sitter_awk() as _) }
}

pub fn language_bash() -> Language {
    unsafe { Language::from_raw(tree_sitter_bash() as _) }
}

pub fn language_beancount() -> Language {
    unsafe { Language::from_raw(tree_sitter_beancount() as _) }
}

pub fn language_bibtex() -> Language {
    unsafe { Language::from_raw(tree_sitter_bibtex() as _) }
}

pub fn language_bicep() -> Language {
    unsafe { Language::from_raw(tree_sitter_bicep() as _) }
}

pub fn language_bitbake() -> Language {
    unsafe { Language::from_raw(tree_sitter_bitbake() as _) }
}

pub fn language_blade() -> Language {
    unsafe { Language::from_raw(tree_sitter_blade() as _) }
}

pub fn language_c() -> Language {
    unsafe { Language::from_raw(tree_sitter_c() as _) }
}

pub fn language_cairo() -> Language {
    unsafe { Language::from_raw(tree_sitter_cairo() as _) }
}

pub fn language_capnp() -> Language {
    unsafe { Language::from_raw(tree_sitter_capnp() as _) }
}

pub fn language_cfml() -> Language {
    unsafe { Language::from_raw(tree_sitter_cfml() as _) }
}

pub fn language_cfscript() -> Language {
    unsafe { Language::from_raw(tree_sitter_cfscript() as _) }
}

pub fn language_clojure() -> Language {
    unsafe { Language::from_raw(tree_sitter_clojure() as _) }
}

pub fn language_cmake() -> Language {
    unsafe { Language::from_raw(tree_sitter_cmake() as _) }
}

pub fn language_commonlisp() -> Language {
    unsafe { Language::from_raw(tree_sitter_commonlisp() as _) }
}

pub fn language_cpp() -> Language {
    unsafe { Language::from_raw(tree_sitter_cpp() as _) }
}

pub fn language_crystal() -> Language {
    unsafe { Language::from_raw(tree_sitter_crystal() as _) }
}

pub fn language_css() -> Language {
    unsafe { Language::from_raw(tree_sitter_css() as _) }
}

pub fn language_csv() -> Language {
    unsafe { Language::from_raw(tree_sitter_csv() as _) }
}

pub fn language_cuda() -> Language {
    unsafe { Language::from_raw(tree_sitter_cuda() as _) }
}

pub fn language_c_sharp() -> Language {
    unsafe { Language::from_raw(tree_sitter_c_sharp() as _) }
}

pub fn language_d() -> Language {
    unsafe { Language::from_raw(tree_sitter_d() as _) }
}

pub fn language_dart() -> Language {
    unsafe { Language::from_raw(tree_sitter_dart() as _) }
}

pub fn language_devicetree() -> Language {
    unsafe { Language::from_raw(tree_sitter_devicetree() as _) }
}

pub fn language_diff() -> Language {
    unsafe { Language::from_raw(tree_sitter_diff() as _) }
}

pub fn language_dockerfile() -> Language {
    unsafe { Language::from_raw(tree_sitter_dockerfile() as _) }
}

pub fn language_dotenv() -> Language {
    unsafe { Language::from_raw(tree_sitter_dotenv() as _) }
}

pub fn language_elisp() -> Language {
    unsafe { Language::from_raw(tree_sitter_elisp() as _) }
}

pub fn language_elixir() -> Language {
    unsafe { Language::from_raw(tree_sitter_elixir() as _) }
}

pub fn language_elm() -> Language {
    unsafe { Language::from_raw(tree_sitter_elm() as _) }
}

pub fn language_erlang() -> Language {
    unsafe { Language::from_raw(tree_sitter_erlang() as _) }
}

pub fn language_fennel() -> Language {
    unsafe { Language::from_raw(tree_sitter_fennel() as _) }
}

pub fn language_fish() -> Language {
    unsafe { Language::from_raw(tree_sitter_fish() as _) }
}

pub fn language_form() -> Language {
    unsafe { Language::from_raw(tree_sitter_form() as _) }
}

pub fn language_fortran() -> Language {
    unsafe { Language::from_raw(tree_sitter_fortran() as _) }
}

pub fn language_fsharp() -> Language {
    unsafe { Language::from_raw(tree_sitter_fsharp() as _) }
}

pub fn language_func() -> Language {
    unsafe { Language::from_raw(tree_sitter_func() as _) }
}

pub fn language_gdscript() -> Language {
    unsafe { Language::from_raw(tree_sitter_gdscript() as _) }
}

pub fn language_gitattributes() -> Language {
    unsafe { Language::from_raw(tree_sitter_gitattributes() as _) }
}

pub fn language_gitignore() -> Language {
    unsafe { Language::from_raw(tree_sitter_gitignore() as _) }
}

pub fn language_gleam() -> Language {
    unsafe { Language::from_raw(tree_sitter_gleam() as _) }
}

pub fn language_glsl() -> Language {
    unsafe { Language::from_raw(tree_sitter_glsl() as _) }
}

pub fn language_gn() -> Language {
    unsafe { Language::from_raw(tree_sitter_gn() as _) }
}

pub fn language_go() -> Language {
    unsafe { Language::from_raw(tree_sitter_go() as _) }
}

pub fn language_gomod() -> Language {
    unsafe { Language::from_raw(tree_sitter_gomod() as _) }
}

pub fn language_gotemplate() -> Language {
    unsafe { Language::from_raw(tree_sitter_gotmpl() as _) }
}

pub fn language_graphql() -> Language {
    unsafe { Language::from_raw(tree_sitter_graphql() as _) }
}

pub fn language_groovy() -> Language {
    unsafe { Language::from_raw(tree_sitter_groovy() as _) }
}

pub fn language_hare() -> Language {
    unsafe { Language::from_raw(tree_sitter_hare() as _) }
}

pub fn language_haskell() -> Language {
    unsafe { Language::from_raw(tree_sitter_haskell() as _) }
}

pub fn language_hcl() -> Language {
    unsafe { Language::from_raw(tree_sitter_hcl() as _) }
}

pub fn language_hlsl() -> Language {
    unsafe { Language::from_raw(tree_sitter_hlsl() as _) }
}

pub fn language_html() -> Language {
    unsafe { Language::from_raw(tree_sitter_html() as _) }
}

pub fn language_hyprlang() -> Language {
    unsafe { Language::from_raw(tree_sitter_hyprlang() as _) }
}

pub fn language_ini() -> Language {
    unsafe { Language::from_raw(tree_sitter_ini() as _) }
}

pub fn language_ispc() -> Language {
    unsafe { Language::from_raw(tree_sitter_ispc() as _) }
}

pub fn language_janet() -> Language {
    unsafe { Language::from_raw(tree_sitter_janet_simple() as _) }
}

pub fn language_java() -> Language {
    unsafe { Language::from_raw(tree_sitter_java() as _) }
}

pub fn language_javascript() -> Language {
    unsafe { Language::from_raw(tree_sitter_javascript() as _) }
}

pub fn language_jinja2() -> Language {
    unsafe { Language::from_raw(tree_sitter_jinja2() as _) }
}

pub fn language_jsdoc() -> Language {
    unsafe { Language::from_raw(tree_sitter_jsdoc() as _) }
}

pub fn language_json() -> Language {
    unsafe { Language::from_raw(tree_sitter_json() as _) }
}

pub fn language_json5() -> Language {
    unsafe { Language::from_raw(tree_sitter_json5() as _) }
}

pub fn language_jsonnet() -> Language {
    unsafe { Language::from_raw(tree_sitter_jsonnet() as _) }
}

pub fn language_julia() -> Language {
    unsafe { Language::from_raw(tree_sitter_julia() as _) }
}

pub fn language_just() -> Language {
    unsafe { Language::from_raw(tree_sitter_just() as _) }
}

pub fn language_kconfig() -> Language {
    unsafe { Language::from_raw(tree_sitter_kconfig() as _) }
}

pub fn language_kdl() -> Language {
    unsafe { Language::from_raw(tree_sitter_kdl() as _) }
}

pub fn language_kotlin() -> Language {
    unsafe { Language::from_raw(tree_sitter_kotlin() as _) }
}

pub fn language_lean() -> Language {
    unsafe { Language::from_raw(tree_sitter_lean() as _) }
}

pub fn language_linkerscript() -> Language {
    unsafe { Language::from_raw(tree_sitter_linkerscript() as _) }
}

pub fn language_liquid() -> Language {
    unsafe { Language::from_raw(tree_sitter_liquid() as _) }
}

pub fn language_llvm() -> Language {
    unsafe { Language::from_raw(tree_sitter_llvm() as _) }
}

pub fn language_lua() -> Language {
    unsafe { Language::from_raw(tree_sitter_lua() as _) }
}

pub fn language_luau() -> Language {
    unsafe { Language::from_raw(tree_sitter_luau() as _) }
}

pub fn language_magma() -> Language {
    unsafe { Language::from_raw(tree_sitter_magma() as _) }
}

pub fn language_make() -> Language {
    unsafe { Language::from_raw(tree_sitter_make() as _) }
}

pub fn language_markdown() -> Language {
    unsafe { Language::from_raw(tree_sitter_markdown() as _) }
}

pub fn language_matlab() -> Language {
    unsafe { Language::from_raw(tree_sitter_matlab() as _) }
}

pub fn language_mermaid() -> Language {
    unsafe { Language::from_raw(tree_sitter_mermaid() as _) }
}

pub fn language_meson() -> Language {
    unsafe { Language::from_raw(tree_sitter_meson() as _) }
}

pub fn language_move() -> Language {
    unsafe { Language::from_raw(tree_sitter_move() as _) }
}

pub fn language_nasm() -> Language {
    unsafe { Language::from_raw(tree_sitter_nasm() as _) }
}

pub fn language_nickel() -> Language {
    unsafe { Language::from_raw(tree_sitter_nickel() as _) }
}

pub fn language_nix() -> Language {
    unsafe { Language::from_raw(tree_sitter_nix() as _) }
}

pub fn language_objc() -> Language {
    unsafe { Language::from_raw(tree_sitter_objc() as _) }
}

pub fn language_objectscript_routine() -> Language {
    unsafe { Language::from_raw(tree_sitter_objectscript_routine() as _) }
}

pub fn language_objectscript_udl() -> Language {
    unsafe { Language::from_raw(tree_sitter_objectscript_udl() as _) }
}

pub fn language_ocaml() -> Language {
    unsafe { Language::from_raw(tree_sitter_ocaml() as _) }
}

pub fn language_odin() -> Language {
    unsafe { Language::from_raw(tree_sitter_odin() as _) }
}

pub fn language_pascal() -> Language {
    unsafe { Language::from_raw(tree_sitter_pascal() as _) }
}

pub fn language_perl() -> Language {
    unsafe { Language::from_raw(tree_sitter_perl() as _) }
}

pub fn language_php() -> Language {
    unsafe { Language::from_raw(tree_sitter_php_only() as _) }
}

pub fn language_pine() -> Language {
    unsafe { Language::from_raw(tree_sitter_pine() as _) }
}

pub fn language_pkl() -> Language {
    unsafe { Language::from_raw(tree_sitter_pkl() as _) }
}

pub fn language_po() -> Language {
    unsafe { Language::from_raw(tree_sitter_po() as _) }
}

pub fn language_pony() -> Language {
    unsafe { Language::from_raw(tree_sitter_pony() as _) }
}

pub fn language_powershell() -> Language {
    unsafe { Language::from_raw(tree_sitter_powershell() as _) }
}

pub fn language_prisma() -> Language {
    unsafe { Language::from_raw(tree_sitter_prisma() as _) }
}

pub fn language_properties() -> Language {
    unsafe { Language::from_raw(tree_sitter_properties() as _) }
}

pub fn language_protobuf() -> Language {
    unsafe { Language::from_raw(tree_sitter_proto() as _) }
}

pub fn language_puppet() -> Language {
    unsafe { Language::from_raw(tree_sitter_puppet() as _) }
}

pub fn language_purescript() -> Language {
    unsafe { Language::from_raw(tree_sitter_purescript() as _) }
}

pub fn language_python() -> Language {
    unsafe { Language::from_raw(tree_sitter_python() as _) }
}

pub fn language_qml() -> Language {
    unsafe { Language::from_raw(tree_sitter_qmljs() as _) }
}

pub fn language_r() -> Language {
    unsafe { Language::from_raw(tree_sitter_r() as _) }
}

pub fn language_racket() -> Language {
    unsafe { Language::from_raw(tree_sitter_racket() as _) }
}

pub fn language_regex() -> Language {
    unsafe { Language::from_raw(tree_sitter_regex() as _) }
}

pub fn language_requirements() -> Language {
    unsafe { Language::from_raw(tree_sitter_requirements() as _) }
}

pub fn language_rescript() -> Language {
    unsafe { Language::from_raw(tree_sitter_rescript() as _) }
}

pub fn language_ron() -> Language {
    unsafe { Language::from_raw(tree_sitter_ron() as _) }
}

pub fn language_rst() -> Language {
    unsafe { Language::from_raw(tree_sitter_rst() as _) }
}

pub fn language_ruby() -> Language {
    unsafe { Language::from_raw(tree_sitter_ruby() as _) }
}

pub fn language_rust() -> Language {
    unsafe { Language::from_raw(tree_sitter_rust() as _) }
}

pub fn language_scala() -> Language {
    unsafe { Language::from_raw(tree_sitter_scala() as _) }
}

pub fn language_scheme() -> Language {
    unsafe { Language::from_raw(tree_sitter_scheme() as _) }
}

pub fn language_scss() -> Language {
    unsafe { Language::from_raw(tree_sitter_scss() as _) }
}

pub fn language_slang() -> Language {
    unsafe { Language::from_raw(tree_sitter_slang() as _) }
}

pub fn language_smali() -> Language {
    unsafe { Language::from_raw(tree_sitter_smali() as _) }
}

pub fn language_smithy() -> Language {
    unsafe { Language::from_raw(tree_sitter_smithy() as _) }
}

pub fn language_solidity() -> Language {
    unsafe { Language::from_raw(tree_sitter_solidity() as _) }
}

pub fn language_soql() -> Language {
    unsafe { Language::from_raw(tree_sitter_soql() as _) }
}

pub fn language_sosl() -> Language {
    unsafe { Language::from_raw(tree_sitter_sosl() as _) }
}

pub fn language_sql() -> Language {
    unsafe { Language::from_raw(tree_sitter_sql() as _) }
}

pub fn language_squirrel() -> Language {
    unsafe { Language::from_raw(tree_sitter_squirrel() as _) }
}

pub fn language_sshconfig() -> Language {
    unsafe { Language::from_raw(tree_sitter_ssh_config() as _) }
}

pub fn language_starlark() -> Language {
    unsafe { Language::from_raw(tree_sitter_starlark() as _) }
}

pub fn language_svelte() -> Language {
    unsafe { Language::from_raw(tree_sitter_svelte() as _) }
}

pub fn language_sway() -> Language {
    unsafe { Language::from_raw(tree_sitter_sway() as _) }
}

pub fn language_swift() -> Language {
    unsafe { Language::from_raw(tree_sitter_swift() as _) }
}

pub fn language_systemverilog() -> Language {
    unsafe { Language::from_raw(tree_sitter_systemverilog() as _) }
}

pub fn language_tablegen() -> Language {
    unsafe { Language::from_raw(tree_sitter_tablegen() as _) }
}

pub fn language_tcl() -> Language {
    unsafe { Language::from_raw(tree_sitter_tcl() as _) }
}

pub fn language_teal() -> Language {
    unsafe { Language::from_raw(tree_sitter_teal() as _) }
}

pub fn language_templ() -> Language {
    unsafe { Language::from_raw(tree_sitter_templ() as _) }
}

pub fn language_thrift() -> Language {
    unsafe { Language::from_raw(tree_sitter_thrift() as _) }
}

pub fn language_tlaplus() -> Language {
    unsafe { Language::from_raw(tree_sitter_tlaplus() as _) }
}

pub fn language_toml() -> Language {
    unsafe { Language::from_raw(tree_sitter_toml() as _) }
}

pub fn language_tsx() -> Language {
    unsafe { Language::from_raw(tree_sitter_tsx() as _) }
}

pub fn language_typescript() -> Language {
    unsafe { Language::from_raw(tree_sitter_typescript() as _) }
}

pub fn language_typst() -> Language {
    unsafe { Language::from_raw(tree_sitter_typst() as _) }
}

pub fn language_verilog() -> Language {
    unsafe { Language::from_raw(tree_sitter_verilog() as _) }
}

pub fn language_vhdl() -> Language {
    unsafe { Language::from_raw(tree_sitter_vhdl() as _) }
}

pub fn language_vim() -> Language {
    unsafe { Language::from_raw(tree_sitter_vim() as _) }
}

pub fn language_vue() -> Language {
    unsafe { Language::from_raw(tree_sitter_vue() as _) }
}

pub fn language_wgsl() -> Language {
    unsafe { Language::from_raw(tree_sitter_wgsl() as _) }
}

pub fn language_wit() -> Language {
    unsafe { Language::from_raw(tree_sitter_wit() as _) }
}

pub fn language_wolfram() -> Language {
    unsafe { Language::from_raw(tree_sitter_wolfram() as _) }
}

pub fn language_xml() -> Language {
    unsafe { Language::from_raw(tree_sitter_xml() as _) }
}

pub fn language_yaml() -> Language {
    unsafe { Language::from_raw(tree_sitter_yaml() as _) }
}

pub fn language_zig() -> Language {
    unsafe { Language::from_raw(tree_sitter_zig() as _) }
}

pub fn language_zsh() -> Language {
    unsafe { Language::from_raw(tree_sitter_zsh() as _) }
}

