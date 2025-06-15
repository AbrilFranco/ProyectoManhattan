from flask import Flask, request, jsonify, render_template
import osmnx as ox
import networkx as nx
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)

# Descargar el grafo solo una vez (Jilotepec, México y alrededores)
G = ox.graph_from_place("Jilotepec, México", network_type="drive")
G = ox.add_edge_speeds(G)
G = ox.add_edge_travel_times(G)

# Precios fijos por litro
PRECIOS_COMBUSTIBLE = {
    "magna": 21.79,
    "premium": 23.71,
    "diesel": 23.16
}

# ------------------------------------------
# Página principal
@app.route('/')
def index():
    return render_template('index.html')

# ------------------------------------------
# API: Calcular ruta Manhattan realista por calles
@app.route('/api/manhattan_route', methods=['POST'])
def manhattan_route():
    try:
        data = request.get_json()

        origin = tuple(data.get('origin'))  # [lat, lon]
        destination = tuple(data.get('destination'))  # [lat, lon]
        fuel_efficiency = float(data.get('fuel_efficiency', 10))
        fuel_type = data.get('fuel_type')

        # Validaciones básicas
        if not origin or not destination:
            return jsonify({"error": "Origen o destino inválido."}), 400

        # Convertir a nodos más cercanos en el grafo
        origin_node = ox.distance.nearest_nodes(G, origin[1], origin[0])
        dest_node = ox.distance.nearest_nodes(G, destination[1], destination[0])

        # Ruta realista tipo Manhattan (peso = longitud)
        route = nx.shortest_path(G, origin_node, dest_node, weight='length')

        # Extraer coordenadas de los nodos
        route_coords = [(G.nodes[n]['y'], G.nodes[n]['x']) for n in route]

        # Calcular distancia total
        distance_m = sum(ox.utils_graph.get_route_edge_attributes(G, route, 'length'))
        distance_km = distance_m / 1000

        # Calcular duración (en segundos)
        total_time_sec = sum(ox.utils_graph.get_route_edge_attributes(G, route, 'travel_time'))
        duration_hr = total_time_sec / 3600

        # Calcular combustible
        fuel_liters = distance_km / fuel_efficiency if fuel_efficiency > 0 else 0
        fuel_price = PRECIOS_COMBUSTIBLE.get(fuel_type, 0)
        fuel_cost = fuel_liters * fuel_price

        return jsonify({
            "route": route_coords,
            "distance_km": round(distance_km, 2),
            "duration_hr": round(duration_hr, 2),
            "fuel_liters": round(fuel_liters, 2),
            "fuel_cost": round(fuel_cost, 2)
        })

    except Exception as e:
        return jsonify({"error": f"Error al calcular la ruta: {str(e)}"}), 500

# ------------------------------------------
# Ejecutar la app
if __name__ == '__main__':
    app.run(debug=True)
