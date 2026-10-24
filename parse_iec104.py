import os
import re
import glob
import pandas as pd
from datetime import datetime
import sys
import shutil
from openpyxl.worksheet.datavalidation import DataValidation

def load_definitions(def_folder):
    """
    Lee los archivos .DEF de la carpeta especificada y crea un diccionario
    con la correspondencia: "Código" -> "Nombre del Elemento".
    Ejemplo: "ME 11" -> "VOLTAJE_DE_BARRA_2_230_KV"
    """
    definitions = {}
    print(f"Cargando archivos de definición desde: {def_folder}")
    
    # Buscar todos los archivos .DEF
    def_files = glob.glob(os.path.join(def_folder, "*.DEF"))
    for file_path in def_files:
        filename = os.path.basename(file_path)
        # Extraer el prefijo del nombre, por ejemplo de ND104S_ME_DATA.DEF -> ME
        match = re.search(r'_([A-Z]{2})_', filename)
        if match:
            prefix = match.group(1)
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        
                        # Separar por tabulaciones o espacios múltiples
                        parts = line.split('\t')
                        if len(parts) == 1:
                            # Intento de separar por espacios si no hay tabulaciones
                            parts = line.split()
                            
                        if len(parts) >= 2:
                            element_id = parts[0].strip()
                            element_name = parts[-1].strip() # La última columna
                            key = f"{prefix} {element_id}"
                            definitions[key] = element_name
            except Exception as e:
                print(f"Error al leer {filename}: {e}")
                
    print(f"Se cargaron {len(definitions)} definiciones.")
    return definitions

def sanitize_sheet_name(name):
    """Limpia el nombre para que sea válido como hoja de Excel y máximo 31 caracteres."""
    invalid_chars = ['\\', '/', '*', '?', ':', '[', ']']
    for ch in invalid_chars:
        name = name.replace(ch, '_')
    return name[:31]

def parse_log_file(file_path, start_time_str, end_time_str, output_file, def_folder):
    try:
        start_time = datetime.strptime(start_time_str, "%H:%M").time()
        end_time = datetime.strptime(end_time_str, "%H:%M").time()
    except ValueError:
        print("Error: El formato de hora debe ser HH:MM (ej. 14:26)")
        return

    # Cargamos el diccionario de definiciones
    definitions = load_definitions(def_folder)

    # Expresión regular para capturar los datos necesarios:
    # Acepta cualquier prefijo de 2 letras (ME, DP, SP, etc.) y su número
    log_pattern = re.compile(r"^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3}):\s+([A-Z]{2}\s+\d+):\s+real\s+([-\d.]+)\s+save\s+([-\d.]+)")

    data_records = []

    print(f"Procesando el archivo de log: {file_path}")
    print(f"Filtrando desde {start_time_str} hasta {end_time_str}...")

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                
                match = log_pattern.search(line)
                if match:
                    date_str = match.group(1)
                    time_str_full = match.group(2)
                    codigo = match.group(3)
                    val_real = float(match.group(4))
                    val_save = float(match.group(5))
                    
                    # Convertimos la hora para comparar con el rango
                    time_obj = datetime.strptime(time_str_full, "%H:%M:%S.%f").time()
                    
                    if start_time <= time_obj <= end_time:
                        # Buscar el nombre del elemento en el diccionario de definiciones, si no está se deja el código
                        nombre_elemento = definitions.get(codigo, codigo)
                        
                        data_records.append({
                            "Fecha": date_str,
                            "Hora": time_str_full,
                            "Código": codigo,
                            "Elemento": nombre_elemento,
                            "Real": val_real,
                            "Save": val_save
                        })
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo {file_path}")
        return
    except Exception as e:
        print(f"Error inesperado al leer el archivo de log: {e}")
        return

    if not data_records:
        print("No se encontraron registros en el rango de tiempo especificado.")
        return

    print(f"Se encontraron {len(data_records)} registros. Creando archivo Excel...")

    df = pd.DataFrame(data_records)

    # Convertir Fecha y Hora a datetime para ordenar y rellenar correctamente
    df['Datetime'] = pd.to_datetime(df['Fecha'] + ' ' + df['Hora'])

    try:
        # Usar la plantilla proporcionada por el usuario
        template_file = "PlantillaGraficosIEC104.xlsm"
        if not os.path.exists(template_file):
            print(f"Error: No se encontró la plantilla {template_file}. Por favor, créala en esta misma carpeta.")
            return

        # Copiar la plantilla al archivo de salida para preservar la macro
        shutil.copy(template_file, output_file)

        # Abrir el archivo copiado en modo 'a' (append) con 'overlay' para no borrar los botones de la hoja
        # Se añade engine_kwargs={'keep_vba': True} para que la estructura del macro no se corrompa
        with pd.ExcelWriter(output_file, engine='openpyxl', mode='a', if_sheet_exists='overlay', engine_kwargs={'keep_vba': True}) as writer:
            
            # --- 1. Crear Dashboard y Datos Consolidados para Gráficos ---
            pivot_df = df.pivot_table(index='Datetime', columns='Elemento', values='Real', aggfunc='last')
            pivot_df.ffill(inplace=True)
            
            summary_df = pd.DataFrame({
                'Máximo': pivot_df.max(),
                'Momento Max': pivot_df.idxmax().dt.strftime('%Y-%m-%d %H:%M:%S.%f').str[:-3],
                'Mínimo': pivot_df.min(),
                'Momento Min': pivot_df.idxmin().dt.strftime('%Y-%m-%d %H:%M:%S.%f').str[:-3],
                'Promedio': pivot_df.mean()
            })
            summary_df.index.name = 'Elemento'
            
            # Agregar la columna de 'Graficar' para el menú desplegable
            summary_df['Graficar'] = 'No'
            
            # Agregar la columna de 'Graficar' para el menú desplegable
            summary_df['Segunda Variable'] = 'No'

            # Guardar el Dashboard y los datos para gráficos
            summary_df.to_excel(writer, sheet_name='Dashboard')
            
            # Removemos la conversión a texto para que Excel lo reconozca como fecha/hora real
            # pivot_df.index = pivot_df.index.strftime('%Y-%m-%d %H:%M:%S.%f').str[:-3]
            pivot_df.to_excel(writer, sheet_name='Datos_Graficos')
            
            # Aplicar la validación de datos (Lista desplegable "Sí, No") en la columna "Graficar" (Columna G)
            ws_dashboard = writer.sheets['Dashboard']
            
            # Asumiendo que Elemento es A, Máximo es B, Momento Max es C, Mínimo es D, Momento Min es E, Promedio es F, Graficar es G
            # Fila 1 es el encabezado, los datos van de la fila 2 en adelante
            dv = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
            ws_dashboard.add_data_validation(dv)
            
            last_row = len(summary_df) + 1
            # Añadir validación desde G2 hasta G(last_row)
            dv.add(f"G2:G{last_row}")

            dv = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
            ws_dashboard.add_data_validation(dv)
            
            last_row = len(summary_df) + 1
            # Añadir validación desde G2 hasta G(last_row)
            dv.add(f"H2:H{last_row}")

            # -------------------------------------------------------------

            # --- 2. Agrupar los datos originales (sin alterar) para las hojas individuales ---
            grouped = df.groupby("Elemento")
            for elemento, group in grouped:
                sheet_name = sanitize_sheet_name(str(elemento))
                
                columns_order = ["Fecha", "Hora", "Código", "Elemento", "Real", "Save"]
                group_to_save = group[columns_order]
                
                group_to_save.to_excel(writer, sheet_name=sheet_name, index=False)
                
        print(f"Archivo Excel con Macros generado con éxito: {output_file}")
    except Exception as e:
        print(f"Error al escribir el archivo Excel: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 6:
        print("Uso: python parse_iec104.py <archivo_log> <hora_inicio(HH:MM)> <hora_fin(HH:MM)> <archivo_salida.xlsm> <carpeta_definiciones>")
        print("Ejemplo: python parse_iec104.py \"IEC104S_COM_ND104S_LOG07(0).txt\" 14:26 14:35 salida.xlsm \"iec104s-nd\"")
        sys.exit(1)
        
    log_file = sys.argv[1]
    start_time = sys.argv[2]
    end_time = sys.argv[3]
    output_excel = sys.argv[4]
    def_folder = sys.argv[5]
    
    parse_log_file(log_file, start_time, end_time, output_excel, def_folder)
