use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;
use web_sys::{CanvasGradient, CanvasRenderingContext2d, HtmlCanvasElement, Path2d};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesignFill {
    pub r#type: String,
    pub color: Option<String>,
    pub stops: Option<Vec<DesignGradientStop>>,
    pub opacity: Option<f64>,
    pub visible: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesignGradientStop {
    pub color: String,
    pub position: f64,
    pub opacity: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesignStroke {
    pub color: String,
    pub weight: f64,
    pub opacity: Option<f64>,
    pub visible: Option<bool>,
    pub align: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesignEffect {
    pub r#type: String,
    pub color: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub radius: Option<f64>,
    pub opacity: Option<f64>,
    pub visible: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DesignLayer {
    pub id: String,
    pub name: String,
    pub r#type: String, // "group", "frame", "rectangle", "ellipse", "triangle", "text", "draw"
    pub parent_id: Option<String>,
    pub visible: bool,
    pub locked: bool,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub fill: String,
    pub fills: Option<Vec<DesignFill>>,
    pub strokes: Option<Vec<DesignStroke>>,
    pub effects: Option<Vec<DesignEffect>>,
    pub opacity: Option<f64>,
    pub rotation: Option<f64>,
    pub corner_radius: Option<f64>,
    pub clips_content: Option<bool>,
    pub vector_path: Option<String>,
    pub winding_rule: Option<String>,
    pub text: Option<String>,
    pub points: Option<Vec<Point>>,
}

fn clamp_opacity(value: Option<f64>) -> f64 {
    value.unwrap_or(1.0).max(0.0).min(1.0)
}

fn first_visible_fill(layer: &DesignLayer) -> Option<&DesignFill> {
    if let Some(fills) = &layer.fills {
        return fills.iter().find(|fill| fill.visible.unwrap_or(true));
    }
    None
}

fn has_explicit_visible_fill(layer: &DesignLayer) -> bool {
    layer
        .fills
        .as_ref()
        .map(|fills| fills.iter().any(|fill| fill.visible.unwrap_or(true)))
        .unwrap_or(false)
}

fn visible_strokes(layer: &DesignLayer) -> Vec<&DesignStroke> {
    layer
        .strokes
        .as_ref()
        .map(|strokes| {
            strokes
                .iter()
                .filter(|stroke| stroke.visible.unwrap_or(true) && stroke.weight > 0.0)
                .collect()
        })
        .unwrap_or_default()
}

fn fallback_fill_color(layer: &DesignLayer) -> String {
    if let Some(fill) = first_visible_fill(layer) {
        if fill.r#type == "solid" {
            return fill.color.clone().unwrap_or_else(|| layer.fill.clone());
        }
        if let Some(stops) = &fill.stops {
            if let Some(stop) = stops.first() {
                return stop.color.clone();
            }
        }
    }
    layer.fill.clone()
}

fn add_gradient_stops(gradient: &CanvasGradient, stops: &[DesignGradientStop]) {
    for stop in stops {
        let position = stop.position.max(0.0).min(1.0) as f32;
        let _ = gradient.add_color_stop(position, &stop.color);
    }
}

fn apply_fill_style(
    context: &CanvasRenderingContext2d,
    layer: &DesignLayer,
    local_x: f64,
    _local_y: f64,
) -> f64 {
    if let Some(fill) = first_visible_fill(layer) {
        if fill.r#type == "linear-gradient" {
            if let Some(stops) = &fill.stops {
                let gradient = context.create_linear_gradient(local_x, 0.0, local_x + layer.width, 0.0);
                add_gradient_stops(&gradient, stops);
                context.set_fill_style_canvas_gradient(&gradient);
                return clamp_opacity(fill.opacity);
            }
        }
        if fill.r#type == "radial-gradient" {
            if let Some(stops) = &fill.stops {
                let radius = (layer.width.max(layer.height) / 2.0).max(0.0);
                let gradient = context.create_radial_gradient(0.0, 0.0, 0.0, 0.0, 0.0, radius);
                if let Ok(gradient) = gradient {
                    add_gradient_stops(&gradient, stops);
                    context.set_fill_style_canvas_gradient(&gradient);
                    return clamp_opacity(fill.opacity);
                }
            }
        }
        if fill.r#type == "solid" {
            context.set_fill_style_str(&fill.color.clone().unwrap_or_else(|| layer.fill.clone()));
            return clamp_opacity(fill.opacity);
        }
    }
    context.set_fill_style_str(&layer.fill);
    1.0
}

fn first_drop_shadow(layer: &DesignLayer) -> Option<&DesignEffect> {
    layer.effects.as_ref()?.iter().find(|effect| {
        effect.visible.unwrap_or(true) && effect.r#type == "drop-shadow" && effect.radius.unwrap_or(0.0) > 0.0
    })
}

fn first_layer_blur(layer: &DesignLayer) -> Option<&DesignEffect> {
    layer.effects.as_ref()?.iter().find(|effect| {
        effect.visible.unwrap_or(true) && effect.r#type == "layer-blur" && effect.radius.unwrap_or(0.0) > 0.0
    })
}

fn inner_shadows(layer: &DesignLayer) -> Vec<&DesignEffect> {
    layer
        .effects
        .as_ref()
        .map(|effects| {
            effects
                .iter()
                .filter(|effect| {
                    effect.visible.unwrap_or(true)
                        && effect.r#type == "inner-shadow"
                        && effect.radius.unwrap_or(0.0) > 0.0
                })
                .collect()
        })
        .unwrap_or_default()
}

fn apply_drop_shadow(context: &CanvasRenderingContext2d, layer: &DesignLayer) {
    if let Some(effect) = first_drop_shadow(layer) {
        context.set_shadow_color(&effect.color.clone().unwrap_or_else(|| "#000000".to_string()));
        context.set_shadow_blur(effect.radius.unwrap_or(0.0).max(0.0));
        context.set_shadow_offset_x(effect.x.unwrap_or(0.0));
        context.set_shadow_offset_y(effect.y.unwrap_or(0.0));
    }
}

fn clear_shadow(context: &CanvasRenderingContext2d) {
    context.set_shadow_color("transparent");
    context.set_shadow_blur(0.0);
    context.set_shadow_offset_x(0.0);
    context.set_shadow_offset_y(0.0);
}

fn apply_layer_blur(context: &CanvasRenderingContext2d, layer: &DesignLayer) {
    if let Some(effect) = first_layer_blur(layer) {
        context.set_filter(&format!("blur({}px)", effect.radius.unwrap_or(0.0).max(0.0)));
    }
}

fn clear_filter(context: &CanvasRenderingContext2d) {
    context.set_filter("none");
}

fn rounded_rect_path(context: &CanvasRenderingContext2d, x: f64, y: f64, width: f64, height: f64, radius: f64) {
    let r = radius.max(0.0).min(width.abs() / 2.0).min(height.abs() / 2.0);
    context.begin_path();
    context.move_to(x + r, y);
    context.line_to(x + width - r, y);
    context.quadratic_curve_to(x + width, y, x + width, y + r);
    context.line_to(x + width, y + height - r);
    context.quadratic_curve_to(x + width, y + height, x + width - r, y + height);
    context.line_to(x + r, y + height);
    context.quadratic_curve_to(x, y + height, x, y + height - r);
    context.line_to(x, y + r);
    context.quadratic_curve_to(x, y, x + r, y);
    context.close_path();
}

fn layer_clip_path(context: &CanvasRenderingContext2d, layer: &DesignLayer, x: f64, y: f64) {
    if layer.r#type == "ellipse" {
        context.begin_path();
        let _ = context.ellipse(
            x + layer.width / 2.0,
            y + layer.height / 2.0,
            layer.width / 2.0,
            layer.height / 2.0,
            0.0,
            0.0,
            std::f64::consts::PI * 2.0,
        );
    } else {
        rounded_rect_path(context, x, y, layer.width, layer.height, layer.corner_radius.unwrap_or(0.0));
    }
}

fn apply_ancestor_clips(context: &CanvasRenderingContext2d, layers: &[DesignLayer], layer: &DesignLayer) {
    let mut parent_id = layer.parent_id.clone();
    let mut ancestors: Vec<&DesignLayer> = Vec::new();
    while let Some(id) = parent_id {
        if let Some(parent) = layers.iter().find(|candidate| candidate.id == id) {
            ancestors.push(parent);
            parent_id = parent.parent_id.clone();
        } else {
            break;
        }
    }
    for ancestor in ancestors.iter().rev() {
        if ancestor.clips_content.unwrap_or(false) {
            layer_clip_path(context, ancestor, ancestor.x, ancestor.y);
            context.clip();
        }
    }
}

fn fill_current_path(context: &CanvasRenderingContext2d, layer: &DesignLayer) {
    if layer.winding_rule.as_deref() == Some("evenodd") {
        context.fill_with_canvas_winding_rule(web_sys::CanvasWindingRule::Evenodd);
    } else {
        context.fill();
    }
}

fn render_inner_shadow_path(
    context: &CanvasRenderingContext2d,
    layer: &DesignLayer,
    draw_path: impl Fn(&CanvasRenderingContext2d),
    layer_opacity: f64,
) {
    for effect in inner_shadows(layer) {
        context.save();
        context.set_global_alpha(layer_opacity * clamp_opacity(effect.opacity));
        context.set_stroke_style_str(&effect.color.clone().unwrap_or_else(|| "#000000".to_string()));
        context.set_line_width((effect.radius.unwrap_or(0.0).max(1.0)) * 2.0);
        let _ = context.set_global_composite_operation("source-atop");
        draw_path(context);
        context.stroke();
        let _ = context.set_global_composite_operation("source-over");
        context.restore();
    }
}

#[wasm_bindgen]
pub struct Renderer {
    context: CanvasRenderingContext2d,
    layers: Vec<DesignLayer>,
    is_dragging: bool,
    drag_layer_id: Option<String>,
    last_x: f64,
    last_y: f64,
    width: f64,
    height: f64,
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
}

#[wasm_bindgen]
impl Renderer {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas: HtmlCanvasElement) -> Result<Renderer, JsValue> {
        let context = canvas
            .get_context("2d")?
            .unwrap()
            .dyn_into::<CanvasRenderingContext2d>()?;

        Ok(Renderer {
            context,
            layers: Vec::new(),
            is_dragging: false,
            drag_layer_id: None,
            last_x: 0.0,
            last_y: 0.0,
            width: 1920.0,
            height: 1080.0,
            zoom: 100.0,
            pan_x: 0.0,
            pan_y: 0.0,
        })
    }

    pub fn sync_layers(&mut self, json_str: &str) {
        if let Ok(layers) = serde_json::from_str::<Vec<DesignLayer>>(json_str) {
            self.layers = layers;
        }
    }

    pub fn render(&mut self, width: f64, height: f64, zoom: f64, pan_x: f64, pan_y: f64) {
        self.width = width;
        self.height = height;
        self.zoom = zoom;
        self.pan_x = pan_x;
        self.pan_y = pan_y;

        self.context.clear_rect(0.0, 0.0, width, height);

        let ruler_size = 20.0;
        let horizontal_origin = (width - ruler_size).max(0.0) / 2.0 + pan_x;
        let vertical_origin = (height - ruler_size).max(0.0) / 2.0 + pan_y;
        let pixels_per_unit = zoom / 100.0;

        self.context.save();
        let _ = self.context.translate(horizontal_origin, vertical_origin);
        let _ = self.context.scale(pixels_per_unit, pixels_per_unit);

        for layer in &self.layers {
            if !layer.visible || layer.r#type == "group" {
                continue;
            }

            self.context.save();
            apply_ancestor_clips(&self.context, &self.layers, layer);
            let layer_opacity = clamp_opacity(layer.opacity);
            let fill_color = fallback_fill_color(layer);
            let local_x = -layer.width / 2.0;
            let local_y = -layer.height / 2.0;
            let _ = self.context.translate(layer.x + layer.width / 2.0, layer.y + layer.height / 2.0);
            let _ = self.context.rotate(layer.rotation.unwrap_or(0.0).to_radians());
            
            match layer.r#type.as_str() {
                "rectangle" => {
                    let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                    self.context.set_global_alpha(layer_opacity * fill_opacity);
                    apply_drop_shadow(&self.context, layer);
                    apply_layer_blur(&self.context, layer);
                    rounded_rect_path(
                        &self.context,
                        local_x,
                        local_y,
                        layer.width,
                        layer.height,
                        layer.corner_radius.unwrap_or(0.0),
                    );
                    fill_current_path(&self.context, layer);
                    clear_filter(&self.context);
                    clear_shadow(&self.context);
                    render_inner_shadow_path(&self.context, layer, |context| {
                        rounded_rect_path(
                            context,
                            local_x,
                            local_y,
                            layer.width,
                            layer.height,
                            layer.corner_radius.unwrap_or(0.0),
                        );
                    }, layer_opacity);
                    self.context.set_global_alpha(layer_opacity);
                    for stroke in visible_strokes(layer) {
                        self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                        self.context.set_stroke_style_str(&stroke.color);
                        self.context.set_line_width(stroke.weight);
                        rounded_rect_path(
                            &self.context,
                            local_x,
                            local_y,
                            layer.width,
                            layer.height,
                            layer.corner_radius.unwrap_or(0.0),
                        );
                        self.context.stroke();
                    }
                }
                "ellipse" => {
                    let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                    self.context.set_global_alpha(layer_opacity * fill_opacity);
                    apply_drop_shadow(&self.context, layer);
                    apply_layer_blur(&self.context, layer);
                    self.context.begin_path();
                    let rx = layer.width / 2.0;
                    let ry = layer.height / 2.0;
                    let _ = self.context.ellipse(0.0, 0.0, rx, ry, 0.0, 0.0, std::f64::consts::PI * 2.0);
                    fill_current_path(&self.context, layer);
                    clear_filter(&self.context);
                    clear_shadow(&self.context);
                    render_inner_shadow_path(&self.context, layer, |context| {
                        context.begin_path();
                        let _ = context.ellipse(0.0, 0.0, layer.width / 2.0, layer.height / 2.0, 0.0, 0.0, std::f64::consts::PI * 2.0);
                    }, layer_opacity);
                    for stroke in visible_strokes(layer) {
                        self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                        self.context.set_stroke_style_str(&stroke.color);
                        self.context.set_line_width(stroke.weight);
                        self.context.stroke();
                    }
                }
                "triangle" => {
                    let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                    self.context.set_global_alpha(layer_opacity * fill_opacity);
                    apply_drop_shadow(&self.context, layer);
                    apply_layer_blur(&self.context, layer);
                    self.context.begin_path();
                    self.context.move_to(0.0, local_y);
                    self.context.line_to(local_x + layer.width, local_y + layer.height);
                    self.context.line_to(local_x, local_y + layer.height);
                    self.context.close_path();
                    fill_current_path(&self.context, layer);
                    clear_filter(&self.context);
                    clear_shadow(&self.context);
                    render_inner_shadow_path(&self.context, layer, |context| {
                        context.begin_path();
                        context.move_to(0.0, local_y);
                        context.line_to(local_x + layer.width, local_y + layer.height);
                        context.line_to(local_x, local_y + layer.height);
                        context.close_path();
                    }, layer_opacity);
                    for stroke in visible_strokes(layer) {
                        self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                        self.context.set_stroke_style_str(&stroke.color);
                        self.context.set_line_width(stroke.weight);
                        self.context.stroke();
                    }
                }
                "text" => {
                    let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                    self.context.set_global_alpha(layer_opacity * fill_opacity);
                    apply_drop_shadow(&self.context, layer);
                    apply_layer_blur(&self.context, layer);
                    self.context.set_font("16px sans-serif"); // TODO: Use real font size
                    if let Some(text) = &layer.text {
                        let _ = self.context.fill_text(text, local_x, local_y + 16.0); // Baseline approx
                    }
                    clear_filter(&self.context);
                    clear_shadow(&self.context);
                }
                "draw" => {
                    if let Some(path) = &layer.vector_path {
                        if let Ok(path) = Path2d::new_with_path_string(path) {
                            let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                            self.context.set_global_alpha(layer_opacity * fill_opacity);
                            apply_drop_shadow(&self.context, layer);
                            apply_layer_blur(&self.context, layer);
                            self.context.fill_with_path_2d(&path);
                            clear_filter(&self.context);
                            clear_shadow(&self.context);
                            for stroke in visible_strokes(layer) {
                                self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                                self.context.set_stroke_style_str(&stroke.color);
                                self.context.set_line_width(stroke.weight);
                                self.context.stroke_with_path(&path);
                            }
                        }
                    } else if let Some(points) = &layer.points {
                        if !points.is_empty() {
                            self.context.set_global_alpha(layer_opacity);
                            apply_layer_blur(&self.context, layer);
                            self.context.begin_path();
                            self.context.move_to(local_x + points[0].x, local_y + points[0].y);
                            for p in points.iter().skip(1) {
                                self.context.line_to(local_x + p.x, local_y + p.y);
                            }
                            let strokes = visible_strokes(layer);
                            if let Some(stroke) = strokes.first() {
                                self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                                self.context.set_stroke_style_str(&stroke.color);
                                self.context.set_line_width(stroke.weight);
                            } else {
                                self.context.set_stroke_style_str(&fill_color);
                                self.context.set_line_width(2.0);
                            }
                            self.context.stroke();
                            clear_filter(&self.context);
                        }
                    }
                }
                "frame" => {
                    if has_explicit_visible_fill(layer) {
                        let fill_opacity = apply_fill_style(&self.context, layer, local_x, local_y);
                        self.context.set_global_alpha(layer_opacity * fill_opacity);
                        apply_drop_shadow(&self.context, layer);
                        apply_layer_blur(&self.context, layer);
                        rounded_rect_path(
                            &self.context,
                            local_x,
                            local_y,
                            layer.width,
                            layer.height,
                            layer.corner_radius.unwrap_or(0.0),
                        );
                        fill_current_path(&self.context, layer);
                        clear_filter(&self.context);
                        clear_shadow(&self.context);
                        render_inner_shadow_path(&self.context, layer, |context| {
                            rounded_rect_path(
                                context,
                                local_x,
                                local_y,
                                layer.width,
                                layer.height,
                                layer.corner_radius.unwrap_or(0.0),
                            );
                        }, layer_opacity);
                    }
                    self.context.set_global_alpha(layer_opacity);
                    let strokes = visible_strokes(layer);
                    if strokes.is_empty() {
                        self.context.set_stroke_style_str("#777777");
                        self.context.set_line_width(1.0);
                        rounded_rect_path(
                            &self.context,
                            local_x,
                            local_y,
                            layer.width,
                            layer.height,
                            layer.corner_radius.unwrap_or(0.0),
                        );
                        self.context.stroke();
                    } else {
                        for stroke in strokes {
                            self.context.set_global_alpha(layer_opacity * clamp_opacity(stroke.opacity));
                            self.context.set_stroke_style_str(&stroke.color);
                            self.context.set_line_width(stroke.weight);
                            rounded_rect_path(
                                &self.context,
                                local_x,
                                local_y,
                                layer.width,
                                layer.height,
                                layer.corner_radius.unwrap_or(0.0),
                            );
                            self.context.stroke();
                        }
                    }
                }
                _ => {}
            }
            
            
            self.context.restore();
        }
        self.context.restore();
    }

    fn to_world(&self, px: f64, py: f64) -> (f64, f64) {
        let ruler_size = 20.0;
        let pixels_per_unit = self.zoom / 100.0;
        let horizontal_origin = (self.width - ruler_size).max(0.0) / 2.0 + self.pan_x;
        let vertical_origin = (self.height - ruler_size).max(0.0) / 2.0 + self.pan_y;
        ((px - horizontal_origin) / pixels_per_unit, (py - vertical_origin) / pixels_per_unit)
    }

    pub fn on_mouse_down(&mut self, px: f64, py: f64) -> Option<String> {
        let (x, y) = self.to_world(px, py);
        for layer in self.layers.iter().rev() {
            if layer.locked || !layer.visible || layer.r#type == "group" {
                continue;
            }
            if x >= layer.x && x <= layer.x + layer.width && y >= layer.y && y <= layer.y + layer.height {
                self.is_dragging = true;
                self.drag_layer_id = Some(layer.id.clone());
                self.last_x = x;
                self.last_y = y;
                return Some(layer.id.clone());
            }
        }
        None
    }

    pub fn on_mouse_move(&mut self, px: f64, py: f64) -> Option<String> {
        let (x, y) = self.to_world(px, py);
        if self.is_dragging {
            let dx = x - self.last_x;
            let dy = y - self.last_y;
            
            if let Some(id) = &self.drag_layer_id {
                if let Some(layer) = self.layers.iter_mut().find(|l| l.id == *id) {
                    layer.x += dx;
                    layer.y += dy;
                }
            }
            
            self.last_x = x;
            self.last_y = y;
            
            // Return JSON patch for JS optimistic update if needed
            return self.drag_layer_id.clone();
        }
        None
    }

    pub fn on_mouse_up(&mut self) -> Option<String> {
        self.is_dragging = false;
        let id = self.drag_layer_id.take();
        // Return the layer id so JS can commit the new position
        id
    }
    
    pub fn get_layer_patch(&self, id: &str) -> Option<String> {
        if let Some(layer) = self.layers.iter().find(|l| l.id == id) {
            return serde_json::to_string(layer).ok();
        }
        None
    }
}
