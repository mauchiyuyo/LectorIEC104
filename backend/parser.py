"""
parser.py
Módulo de parsing y procesamiento de logs SCADA IEC104.
Soporta lectura simultánea y combinación de fuentes redundantes (PC1 y PC2) en el NAS.
"""
import glob
import os
import re
import shutil
from datetime import datetime, time
from typing import Dict, List, Optional, Tuple

import pandas as pd
from openpyxl.worksheet.datavalidation import DataValidation

# Expresión regular para capturar los registros del log IEC104
LOG_PATTERN = re.compile(
    r"^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3}):\s+([A-Z]{2}\s+\d+):\s+real\s+([-\d.]+)\s+save\s+([-\d.]+)"
)


def load_definitions(def_folder: str) -> Dict[str, str]:
    """
    Lee los archivos .DEF de la carpeta especificada y crea un diccionario
    con la correspondencia: "Código" -> "Nombre del Elemento".
    Ejemplo: "ME 11" -> "VOLTAJE_DE_BARRA_2_230_KV"
    """
    definitions: Dict[str, str] = {}
    if not os.path.exists(def_folder):
        return definitions

    def_files = glob.glob(os.path.join(def_folder, "*.DEF")) + glob.glob(os.path.join(def_folder, "*.def"))
    for file_path in def_files:
        filename = os.path.basename(file_path)
        match = re.search(r'_([A-Z]{2})_', filename)
        if match:
            prefix = match.group(1)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        parts = line.split("\t")
                        if len(parts) == 1:
                            parts = line.split()
                        if len(parts) >= 2:
                            element_id = parts[0].strip()
                            element_name = parts[-1].strip()
                            key = f"{prefix} {element_id}"
                            definitions[key] = element_name
            except Exception as e:
                print(f"Advertencia: Error al leer definición {filename}: {e}")

    return definitions


def find_candidate_log_files(
    target_date: str,
    nas_base_path: str = r"\\NAS-CHMSF\Respaldo_SCADA\IEC104",
    local_fallback_dirs: Optional[List[str]] = None
) -> Dict[str, List[str]]:
    """
    Encuentra los archivos de log para una fecha dada (formato 'YYYY-MM-DD').
    Busca tanto en PC1 como en PC2 según la ruta:
        \\NAS-CHMSF\\Respaldo_SCADA\\IEC104\\PC1\\YYYY\\MM\\*LOG{DD}*.txt
        \\NAS-CHMSF\\Respaldo_SCADA\\IEC104\\PC2\\YYYY\\MM\\*LOG{DD}*.txt
    Retorna un diccionario: {"PC1": [...], "PC2": [...], "LOCAL": [...]}
    """
    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError:
        return {"PC1": [], "PC2": [], "LOCAL": []}

    year_str = dt.strftime("%Y")
    month_str = dt.strftime("%m")
    day_str = dt.strftime("%d")

    results: Dict[str, List[str]] = {"PC1": [], "PC2": []}

    for pc in ["PC1", "PC2"]:
        pc_dir = os.path.join(nas_base_path, pc, year_str, month_str)
        if os.path.exists(pc_dir):
            # Patrón específico con el número de día del mes, e.g. *LOG08*.txt
            day_pattern = os.path.join(pc_dir, f"*LOG{day_str}*.txt")
            matched = glob.glob(day_pattern)
            if not matched:
                # Si no encuentra coincidencia exacta con el día, busca todos los .txt del mes
                matched = glob.glob(os.path.join(pc_dir, "*.txt"))
            results[pc] = matched
        else:
            results[pc] = []

    # Búsqueda en carpetas locales de respaldo o pruebas (para desarrollo)
    results["LOCAL"] = []
    if local_fallback_dirs:
        for fdir in local_fallback_dirs:
            if os.path.exists(fdir):
                matched = glob.glob(os.path.join(fdir, f"*LOG{day_str}*.txt"))
                if not matched:
                    matched = glob.glob(os.path.join(fdir, "*LOG*.txt"))
                results["LOCAL"].extend(matched)

    return results


def parse_single_file(
    file_path: str,
    target_date: str,
    start_time_obj: time,
    end_time_obj: time,
    definitions: Dict[str, str],
    origen: str = "PC1"
) -> List[dict]:
    """Parsea un archivo individual y filtra por rango de fecha y hora."""
    records = []
    if not os.path.exists(file_path):
        return records

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue

                match = LOG_PATTERN.search(line)
                if match:
                    date_str = match.group(1)
                    time_str = match.group(2)
                    codigo = match.group(3)
                    val_real = float(match.group(4))
                    val_save = float(match.group(5))

                    if date_str != target_date:
                        continue

                    # Extraer hora
                    try:
                        time_obj = datetime.strptime(time_str, "%H:%M:%S.%f").time()
                    except ValueError:
                        continue

                    if start_time_obj <= time_obj <= end_time_obj:
                        nombre_elem = definitions.get(codigo, codigo)
                        records.append({
                            "Fecha": date_str,
                            "Hora": time_str,
                            "Datetime": f"{date_str} {time_str}",
                            "Código": codigo,
                            "Elemento": nombre_elem,
                            "Real": val_real,
                            "Save": val_save,
                            "Origen": origen
                        })
    except Exception as e:
        print(f"Error procesando {file_path}: {e}")

    return records


def parse_iec104_redundant(
    target_date: str,
    start_time_str: str,
    end_time_str: str,
    def_folder: str,
    nas_base_path: str = r"\\NAS-CHMSF\Respaldo_SCADA\IEC104",
    local_fallback_dirs: Optional[List[str]] = None,
    filter_elements: Optional[List[str]] = None
) -> Tuple[List[dict], Dict[str, int]]:
    """
    Busca logs en PC1 y PC2, fusiona registros evitando duplicados con prioridad en PC1.
    Retorna la lista de registros consolidados y estadísticas de lectura.
    """
    start_time_obj = datetime.strptime(start_time_str, "%H:%M").time()
    end_time_obj = datetime.strptime(end_time_str, "%H:%M").time()
    definitions = load_definitions(def_folder)

    files_found = find_candidate_log_files(target_date, nas_base_path, local_fallback_dirs)

    pc1_records = []
    for f in files_found.get("PC1", []):
        pc1_records.extend(parse_single_file(f, target_date, start_time_obj, end_time_obj, definitions, "PC1"))

    pc2_records = []
    for f in files_found.get("PC2", []):
        pc2_records.extend(parse_single_file(f, target_date, start_time_obj, end_time_obj, definitions, "PC2"))

    # Si no se encontró nada en el NAS y hay archivos locales, usar locales
    local_records = []
    if not pc1_records and not pc2_records and files_found.get("LOCAL"):
        for f in files_found.get("LOCAL", []):
            local_records.extend(parse_single_file(f, target_date, start_time_obj, end_time_obj, definitions, "LOCAL"))

    # Fusión y Deduplicación:
    # Usamos una clave (Datetime, Código) para identificar un punto único en el tiempo
    records_dict = {}

    # Primero agregamos PC2 (o LOCAL si es el caso)
    for r in (local_records if local_records else pc2_records):
        key = (r["Datetime"], r["Código"])
        records_dict[key] = r

    # Luego agregamos PC1, sobrescribiendo si hay conflicto (prioridad PC1)
    for r in pc1_records:
        key = (r["Datetime"], r["Código"])
        records_dict[key] = r

    consolidated = list(records_dict.values())

    # Filtrar por elementos específicos si el usuario seleccionó un subconjunto
    if filter_elements:
        elem_set = set(filter_elements)
        consolidated = [r for r in consolidated if r["Elemento"] in elem_set or r["Código"] in elem_set]

    # Ordenar por fecha y hora cronológicamente
    consolidated.sort(key=lambda x: x["Datetime"])

    stats = {
        "pc1_archivos": len(files_found.get("PC1", [])),
        "pc2_archivos": len(files_found.get("PC2", [])),
        "local_archivos": len(files_found.get("LOCAL", [])),
        "pc1_registros": len(pc1_records),
        "pc2_registros": len(pc2_records),
        "total_consolidados": len(consolidated)
    }

    return consolidated, stats


def build_analysis_dataset(records: List[dict]) -> dict:
    """
    Genera el resumen estadístico (Dashboard) y los datos de series de tiempo para gráficos web.
    """
    if not records:
        return {"resumen": [], "series": {}, "timestamps": []}

    df = pd.DataFrame(records)
    df["dt_obj"] = pd.to_datetime(df["Datetime"])

    # Pivotear: índice = Datetime, columnas = Elemento, valores = Real
    pivot_df = df.pivot_table(index="dt_obj", columns="Elemento", values="Real", aggfunc="last")
    pivot_df.ffill(inplace=True)

    # Resumen estadístico
    resumen = []
    for col in pivot_df.columns:
        series = pivot_df[col].dropna()
        if not series.empty:
            max_val = float(series.max())
            min_val = float(series.min())
            mean_val = float(series.mean())
            max_dt = series.idxmax().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            min_dt = series.idxmin().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            resumen.append({
                "elemento": str(col),
                "maximo": round(max_val, 4),
                "momento_max": max_dt,
                "minimo": round(min_val, 4),
                "momento_min": min_dt,
                "promedio": round(mean_val, 4)
            })

    # Datos para gráficos web
    timestamps = [dt.strftime("%H:%M:%S") for dt in pivot_df.index]
    series_data = {}
    for col in pivot_df.columns:
        # Reemplazar NaN por None para compatibilidad con JSON
        series_data[col] = [None if pd.isna(v) else round(float(v), 4) for v in pivot_df[col]]

    return {
        "resumen": resumen,
        "series": series_data,
        "timestamps": timestamps
    }


def sanitize_sheet_name(name: str) -> str:
    """Limpia el nombre para que sea válido como hoja de Excel."""
    invalid_chars = ['\\', '/', '*', '?', ':', '[', ']']
    for ch in invalid_chars:
        name = name.replace(ch, '_')
    return name[:31]


def export_to_excel_macro(
    records: List[dict],
    template_path: str,
    output_path: str
) -> str:
    """
    Genera el archivo .xlsm a partir de la plantilla conservando macros y formato.
    """
    if not records:
        raise ValueError("No hay registros para exportar a Excel.")

    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Plantilla no encontrada: {template_path}")

    # Copiar plantilla
    shutil.copy(template_path, output_path)

    df = pd.DataFrame(records)
    df['Datetime'] = pd.to_datetime(df['Fecha'] + ' ' + df['Hora'])

    with pd.ExcelWriter(
        output_path,
        engine='openpyxl',
        mode='a',
        if_sheet_exists='overlay',
        engine_kwargs={'keep_vba': True}
    ) as writer:
        # 1. Pivot y Dashboard
        pivot_df = df.pivot_table(index='Datetime', columns='Elemento', values='Real', aggfunc='last')
        pivot_df.ffill(inplace=True)

        summary_df = pd.DataFrame({
            'Máximo': pivot_df.max(),
            'Momento Max': pivot_df.idxmax().dt.strftime('%Y-%m-%d %H:%M:%S.%f').str[:-3],
            'Mínimo': pivot_df.min(),
            'Momento Min': pivot_df.idxmin().dt.strftime('%Y-%m-%d %H:%M:%S.%f').str[:-3],
            'Promedio': pivot_df.mean(),
            'Graficar': 'No',
            'Segunda Variable': 'No'
        })
        summary_df.index.name = 'Elemento'

        summary_df.to_excel(writer, sheet_name='Dashboard')
        pivot_df.to_excel(writer, sheet_name='Datos_Graficos')

        # Validaciones de lista desplegable en Dashboard
        ws_dashboard = writer.sheets['Dashboard']
        last_row = len(summary_df) + 1

        dv_g = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
        ws_dashboard.add_data_validation(dv_g)
        dv_g.add(f"G2:G{last_row}")

        dv_h = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
        ws_dashboard.add_data_validation(dv_h)
        dv_h.add(f"H2:H{last_row}")

        # 2. Hojas individuales por elemento
        grouped = df.groupby("Elemento")
        cols_order = ["Fecha", "Hora", "Código", "Elemento", "Real", "Save"]
        for elemento, group in grouped:
            sheet_name = sanitize_sheet_name(str(elemento))
            group_to_save = group[cols_order]
            group_to_save.to_excel(writer, sheet_name=sheet_name, index=False)

    return output_path
