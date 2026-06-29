use std::env;
use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::collections::{HashMap, HashSet};

fn main() -> io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: {} <directory> [--json] [--trace <relative_file_path>]", args[0]);
        std::process::exit(1);
    }

    let base_dir_str = &args[1];
    let base_dir = Path::new(base_dir_str);
    if !base_dir.is_dir() {
        eprintln!("Error: {} is not a directory", base_dir_str);
        std::process::exit(1);
    }

    let as_json = args.contains(&"--json".to_string());
    
    let mut trace_target = None;
    if let Some(pos) = args.iter().position(|x| x == "--trace") {
        if pos + 1 < args.len() {
            trace_target = Some(args[pos + 1].replace('\\', "/"));
        }
    }

    let mut files = Vec::new();
    walk_dir(base_dir, &mut files)?;

    // Mapear rutas absolutas a relativas
    let mut rel_files = Vec::new();
    for f in &files {
        if let Ok(rel) = f.strip_prefix(base_dir) {
            rel_files.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }

    // Grafo de adyacencia local: de -> [hacia]
    let mut adj: HashMap<String, HashSet<String>> = HashMap::new();
    let file_set: HashSet<String> = rel_files.iter().cloned().collect();

    for f in &files {
        let rel_src = match f.strip_prefix(base_dir) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        let parent_dir = f.parent().unwrap_or(base_dir);
        let deps = parse_dependencies(f, parent_dir, base_dir, &file_set);
        adj.insert(rel_src, deps);
    }

    let stdout = io::stdout();
    let mut handle = io::BufWriter::new(stdout.lock());

    // Si se especificó el análisis de traceo (Reachability/Impact Analysis)
    if let Some(target) = trace_target {
        writeln!(handle, "=== CASCADE IMPACT TRACE ANALYSIS ===")?;
        writeln!(handle, "Target file: {}\n", target)?;

        if !file_set.contains(&target) {
            writeln!(handle, "Error: Target file not found in workspace file-tree.")?;
            handle.flush()?;
            return Ok(());
        }

        // Construir grafo inverso (quién es importado por quién)
        let mut reverse_adj: HashMap<String, Vec<String>> = HashMap::new();
        for (src, dests) in &adj {
            for dest in dests {
                reverse_adj.entry(dest.clone()).or_default().push(src.clone());
            }
        }

        // Ejecutar BFS para encontrar clausura transitiva
        let mut visited = HashSet::new();
        let mut queue = std::collections::VecDeque::new();
        
        // Nivel de profundidad del impacto
        let mut direct_importers = Vec::new();
        let mut indirect_importers = Vec::new();

        if let Some(importers) = reverse_adj.get(&target) {
            for imp in importers {
                direct_importers.push(imp.clone());
                queue.push_back((imp.clone(), 1));
                visited.insert(imp.clone());
            }
        }

        while let Some((node, depth)) = queue.pop_front() {
            if let Some(importers) = reverse_adj.get(&node) {
                for imp in importers {
                    if !visited.contains(imp) {
                        visited.insert(imp.clone());
                        indirect_importers.push((imp.clone(), depth + 1));
                        queue.push_back((imp.clone(), depth + 1));
                    }
                }
            }
        }

        writeln!(handle, ">>> DIRECTLY AFFECTED FILES (Imports target directly):")?;
        if direct_importers.is_empty() {
            writeln!(handle, "  None")?;
        } else {
            for imp in &direct_importers {
                writeln!(handle, "  - {}", imp)?;
            }
        }

        writeln!(handle, "\n>>> TRANSITIVELY AFFECTED FILES (Indirect impact cascades):")?;
        if indirect_importers.is_empty() {
            writeln!(handle, "  None")?;
        } else {
            for (imp, depth) in &indirect_importers {
                writeln!(handle, "  - {} (cascade level {})", imp, depth)?;
            }
        }

        writeln!(handle, "\nSummary: {} files affected in total by changes to {}", visited.len(), target)?;
        handle.flush()?;
        return Ok(());
    }

    // Calcular Grados
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut out_degree: HashMap<String, usize> = HashMap::new();

    for node in &rel_files {
        in_degree.insert(node.clone(), 0);
        out_degree.insert(node.clone(), 0);
    }

    for (src, dests) in &adj {
        out_degree.insert(src.clone(), dests.len());
        for dest in dests {
            let count = in_degree.entry(dest.clone()).or_insert(0);
            *count += 1;
        }
    }

    // Encontrar Ciclos de dependencias
    let mut cycles = Vec::new();
    let mut visited = HashMap::new(); // 0: unvisited, 1: visiting, 2: visited
    for node in &rel_files {
        visited.insert(node.clone(), 0);
    }

    for node in &rel_files {
        if *visited.get(node).unwrap_or(&0) == 0 {
            let mut path = Vec::new();
            dfs_find_cycles(node, &adj, &mut visited, &mut path, &mut cycles);
        }
    }

    if as_json {
        // Generar un JSON compatible con GraphView en el cliente
        let mut cycle_nodes = HashSet::new();
        let mut cycle_edges = HashSet::new();
        for cycle in &cycles {
            for n in cycle {
                cycle_nodes.insert(n.clone());
            }
            for i in 0..cycle.len() {
                let src = &cycle[i];
                let dst = &cycle[(i + 1) % cycle.len()];
                cycle_edges.insert(format!("{}->{}", src, dst));
            }
        }

        // Serialización manual ultrarápida y sin dependencias externas
        write!(handle, "{{\"nodes\":[")?;
        
        // Agregar nodo raíz
        write!(
            handle,
            "{{\"id\":\".\",\"path\":\"{}\",\"kind\":\"root\",\"size\":1,\"fileType\":\"root\",\"inDegree\":0,\"isCycleNode\":false}}",
            base_dir_str.replace('\\', "/")
        )?;

        // Colección de directorios únicos para aristas
        let mut dirs_seen = HashSet::new();
        let mut edges_json = Vec::new();

        for f in rel_files.iter() {
            let size = get_file_lines(&base_dir.join(f)).unwrap_or(1);
            let ext = Path::new(f)
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();
            
            let is_cycle = cycle_nodes.contains(f);
            let in_deg = in_degree.get(f).unwrap_or(&0);

            write!(
                handle,
                ",{{\"id\":\"{}\",\"path\":\"{}\",\"kind\":\"file\",\"size\":{},\"fileType\":\"{}\",\"inDegree\":{},\"isCycleNode\":{}}}",
                f, base_dir.join(f).to_string_lossy().replace('\\', "/"), size, ext, in_deg, is_cycle
            )?;

            // Reconstruir estructura de carpetas
            let parts: Vec<&str> = f.split('/').collect();
            let mut current_dir_id = String::new();
            let mut prev_dir_id = String::from(".");

            for i in 0..(parts.len() - 1) {
                if !current_dir_id.is_empty() {
                    current_dir_id.push('/');
                }
                current_dir_id.push_str(parts[i]);
                let dir_key = format!("{}/", current_dir_id);
                
                if !dirs_seen.contains(&dir_key) {
                    dirs_seen.insert(dir_key.clone());
                    // Escribir nodo de directorio
                    write!(
                        handle,
                        ",{{\"id\":\"{}\",\"path\":\"{}\",\"kind\":\"dir\",\"size\":0,\"fileType\":\"dir\",\"inDegree\":0,\"isCycleNode\":false}}",
                        dir_key, base_dir.join(&current_dir_id).to_string_lossy().replace('\\', "/")
                    )?;
                    edges_json.push(format!("{{\"source\":\"{}\",\"target\":\"{}\",\"isCycleEdge\":false}}", prev_dir_id, dir_key));
                }
                prev_dir_id = dir_key;
            }
            // Arista desde el directorio padre al archivo
            edges_json.push(format!("{{\"source\":\"{}\",\"target\":\"{}\",\"isCycleEdge\":false}}", prev_dir_id, f));
        }

        write!(handle, "],\"edges\":[")?;

        // Agregar conexiones de carpetas
        for (i, edge) in edges_json.iter().enumerate() {
            if i > 0 {
                write!(handle, ",")?;
            }
            write!(handle, "{}", edge)?;
        }

        // Agregar dependencias de archivos locales
        for (src, dests) in &adj {
            for dest in dests {
                let key = format!("{}->{}", src, dest);
                let is_cycle_edge = cycle_edges.contains(&key);
                write!(
                    handle,
                    ",{{\"source\":\"{}\",\"target\":\"{}\",\"isCycleEdge\":{}}}",
                    src, dest, is_cycle_edge
                )?;
            }
        }

        write!(handle, "]}}")?;
    } else {
        writeln!(handle, "=== TOPOLOGICAL CODE REPORT ===")?;
        writeln!(handle, "Total files analyzed: {}", rel_files.len())?;

        let mut sorted_in: Vec<_> = in_degree.iter().collect();
        sorted_in.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
        writeln!(handle, "\n--- TOP 10 CORE MODULES (Most Imported) ---")?;
        for (i, (file, count)) in sorted_in.iter().take(10).enumerate() {
            if **count > 0 {
                writeln!(handle, " {}. {} (imported by {} files)", i + 1, file, count)?;
            }
        }

        let mut sorted_out: Vec<_> = out_degree.iter().collect();
        sorted_out.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
        writeln!(handle, "\n--- TOP 10 ORCHESTRATORS (Most Dependencies) ---")?;
        for (i, (file, count)) in sorted_out.iter().take(10).enumerate() {
            if **count > 0 {
                writeln!(handle, " {}. {} (imports {} local files)", i + 1, file, count)?;
            }
        }

        if !cycles.is_empty() {
            writeln!(handle, "\n--- CIRCULAR DEPENDENCIES DETECTED ---")?;
            for (i, cycle) in cycles.iter().take(5).enumerate() {
                writeln!(handle, " {}. {}", i + 1, cycle.join(" -> "))?;
            }
            if cycles.len() > 5 {
                writeln!(handle, " ... and {} more cycles.", cycles.len() - 5)?;
            }
        } else {
            writeln!(handle, "\nNo circular dependencies detected!")?;
        }
    }

    handle.flush()?;
    Ok(())
}

fn walk_dir(dir: &Path, files: &mut Vec<PathBuf>) -> io::Result<()> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name() {
                let name_str = file_name.to_string_lossy();
                if name_str.starts_with('.') || name_str == "node_modules" || name_str == "dist" || name_str == "out" {
                    continue;
                }
            }

            if path.is_dir() {
                let _ = walk_dir(&path, files);
            } else if path.is_file() {
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if ["ts", "tsx", "js", "jsx", "py", "rs", "css", "md", "txt", "json", "html", "env", "yaml", "yml"].contains(&ext_str.as_str()) {
                        files.push(path);
                    }
                }
            }
        }
    }
    Ok(())
}

fn get_file_lines(path: &Path) -> io::Result<usize> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    Ok(reader.lines().count())
}

fn parse_dependencies(file_path: &Path, parent_dir: &Path, base_dir: &Path, file_set: &HashSet<String>) -> HashSet<String> {
    let mut deps = HashSet::new();
    let file = match File::open(file_path) {
        Ok(f) => f,
        Err(_) => return deps,
    };
    let reader = BufReader::new(file);

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.contains("import") || line.contains("require(") {
            let spec = extract_import_specifier(&line);
            if let Some(resolved) = resolve_local_import(parent_dir, &spec, base_dir, file_set) {
                deps.insert(resolved);
            }
        }
    }

    deps
}

fn extract_import_specifier(line: &str) -> String {
    let mut start = None;
    let mut quote_char = None;

    for (i, c) in line.char_indices() {
        if quote_char.is_none() {
            if c == '\'' || c == '"' || c == '`' {
                quote_char = Some(c);
                start = Some(i + 1);
            }
        } else if Some(c) == quote_char {
            if let Some(s) = start {
                return line[s..i].to_string();
            }
        }
    }
    String::new()
}

fn resolve_local_import(parent_dir: &Path, spec: &str, base_dir: &Path, file_set: &HashSet<String>) -> Option<String> {
    let candidate_path = if spec.starts_with('.') {
        parent_dir.join(spec)
    } else if let Some(alias_path) = spec.strip_prefix("@/") {
        base_dir.join(alias_path)
    } else {
        return None;
    };
    let exts = vec!["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx", ".rs", ".py", ".css"];

    for ext in exts {
        let full_candidate = if ext.starts_with('/') {
            candidate_path.join(&ext[1..])
        } else {
            let mut p = candidate_path.clone();
            if !ext.is_empty() {
                let mut filename = p.file_name().unwrap_or_default().to_os_string();
                filename.push(ext);
                p.set_file_name(filename);
            }
            p
        };

        if let Ok(rel) = full_candidate.strip_prefix(base_dir) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if file_set.contains(&rel_str) {
                return Some(rel_str);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolves_at_alias_from_workspace_root() {
        let base_dir = Path::new("workspace");
        let parent_dir = Path::new("workspace/src/features");
        let file_set = HashSet::from(["src/shared/util.ts".to_string()]);

        assert_eq!(
            resolve_local_import(parent_dir, "@/src/shared/util", base_dir, &file_set),
            Some("src/shared/util.ts".to_string())
        );
    }

    #[test]
    fn parses_at_alias_imports_from_file() {
        let base_dir = env::temp_dir().join(format!("codeclub-topo-test-{}", std::process::id()));
        let app_dir = base_dir.join("src/app");
        let shared_dir = base_dir.join("src/shared");
        fs::create_dir_all(&app_dir).unwrap();
        fs::create_dir_all(&shared_dir).unwrap();
        let importer = app_dir.join("main.ts");
        fs::write(&importer, "import { value } from \"@/src/shared/util\"\n").unwrap();
        fs::write(shared_dir.join("util.ts"), "export const value = 1\n").unwrap();

        let file_set = HashSet::from([
            "src/app/main.ts".to_string(),
            "src/shared/util.ts".to_string(),
        ]);
        let deps = parse_dependencies(&importer, &app_dir, &base_dir, &file_set);

        fs::remove_dir_all(&base_dir).unwrap();
        assert!(deps.contains("src/shared/util.ts"));
    }
}

fn dfs_find_cycles(
    node: &String,
    adj: &HashMap<String, HashSet<String>>,
    visited: &mut HashMap<String, i32>,
    path: &mut Vec<String>,
    cycles: &mut Vec<Vec<String>>,
) {
    visited.insert(node.clone(), 1);
    path.push(node.clone());

    if let Some(neighbors) = adj.get(node) {
        for neighbor in neighbors {
            let state = visited.get(neighbor).unwrap_or(&0);
            if *state == 1 {
                if let Some(pos) = path.iter().position(|x| x == neighbor) {
                    let mut cycle = path[pos..].to_vec();
                    cycle.push(neighbor.clone());
                    cycles.push(cycle);
                }
            } else if *state == 0 {
                dfs_find_cycles(neighbor, adj, visited, path, cycles);
            }
        }
    }

    path.pop();
    visited.insert(node.clone(), 2);
}
