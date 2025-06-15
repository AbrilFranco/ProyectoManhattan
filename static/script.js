// --- Variables Globales ---
var map = L.map('map').setView([19.4326, -99.1332], 12); 
var buildingLayer = L.layerGroup().addTo(map);
var routeLine = null;
var buildingConnections = L.layerGroup().addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

var originMarker = null;
var destinationMarker = null;
var routeControl = null;

var fuelEfficiency = parseFloat(document.getElementById('fuel_efficiency').value) || 10;
var fuelPrice = 0;

var transportType = '';
var fuelType = '';

const geocoder = L.Control.Geocoder.nominatim();

// --- Funciones de Búsqueda y Rutas ---
function searchRouteByNames() {
    const originName = document.getElementById('search_origin').value;
    const destinationName = document.getElementById('search_destination').value;

    if (!originName || !destinationName) {
        alert("Por favor ingresa origen y destino");
        return;
    }

    clearMarkersAndRoute();

    geocoder.geocode(originName, function(resultsOrigin) {
        if (resultsOrigin?.length > 0) {
            originMarker = createMarker(resultsOrigin[0].center, "Origen", false);
            
            geocoder.geocode(destinationName, function(resultsDestination) {
                if (resultsDestination?.length > 0) {
                    destinationMarker = createMarker(resultsDestination[0].center, "Destino", true);
                    updateRoute();
                } else {
                    alert("No se encontró el destino");
                    clearMarkersAndRoute();
                }
            });
        } else {
            alert("No se encontró el origen");
            clearMarkersAndRoute();
        }
    });
}

function isInBuilding(latlng) {
    const buildingArea = L.latLngBounds(
        L.latLng(19.955, -99.531),
        L.latLng(19.957, -99.529)
    );
    return buildingArea.contains(latlng);
}

function drawBuildingConnections() {
    buildingConnections.clearLayers();
    
    const connectionStyle = {
        color: '#FFA500',
        weight: 4,
        opacity: 0.8,
        dashArray: '10,5'
    };

    if (originMarker && isInBuilding(originMarker.getLatLng())) {
        const start = originMarker.getLatLng();
        const exit = L.latLng(start.lat + 0.001, start.lng + 0.001);
        L.polyline([start, exit], connectionStyle)
            .addTo(buildingConnections)
            .bindPopup("Conexión desde edificio (Origen)");
    }

    if (destinationMarker && isInBuilding(destinationMarker.getLatLng())) {
        const end = destinationMarker.getLatLng();
        const entry = L.latLng(end.lat - 0.001, end.lng - 0.001);
        L.polyline([entry, end], connectionStyle)
            .addTo(buildingConnections)
            .bindPopup("Conexión hacia edificio (Destino)");
    }
}

function highlightBuildingSegments(route) {
    if (routeLine) map.removeLayer(routeLine);
    
    routeLine = L.layerGroup();
    const normalStyle = {color: '#0066FF', weight: 5};
    const buildingStyle = {color: '#FF00FF', weight: 5, dashArray: '5,5'};
    
    route.coordinates.forEach((coord, i) => {
        if (i > 0) {
            const segment = [route.coordinates[i-1], coord];
            const style = isInBuilding(coord) ? buildingStyle : normalStyle;
            L.polyline(segment, style).addTo(routeLine);
        }
    });
    
    routeLine.addTo(map);
    highlightBuildingArea();
}

function highlightBuildingArea() {
    buildingLayer.clearLayers();
    const buildingArea = L.latLngBounds(
        L.latLng(19.955, -99.531),
        L.latLng(19.957, -99.529)
    );
    L.rectangle(buildingArea, {
        color: "#ff7800",
        weight: 1,
        fillOpacity: 0.1
    }).addTo(buildingLayer).bindPopup("Área de edificio");
}

// --- Funciones de Mapa y Marcadores ---
function createMarker(latlng, text, isDestination) {
    const marker = L.marker(latlng, {
        draggable: true,
        icon: isDestination ? 
            new L.Icon({
                iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            }) : 
            new L.Icon.Default()
    }).addTo(map)
    .bindPopup(text)
    .openPopup()
    .on('dragend', updateRoute);

    if (isInBuilding(latlng)) {
        marker.setPopupContent(`${text} (Dentro de edificio)`);
    }

    return marker;
}

map.on('click', function(e) {
    if (!originMarker) {
        originMarker = createMarker(e.latlng, "Origen", false);
        document.getElementById('search_origin').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
    } 
    else if (!destinationMarker) {
        destinationMarker = createMarker(e.latlng, "Destino", true);
        document.getElementById('search_destination').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        updateRoute();
    } 
    else {
        clearMarkersAndRoute();
        originMarker = createMarker(e.latlng, "Origen", false);
        document.getElementById('search_origin').value = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
    }
});

// --- Funciones de Transporte y Combustible ---
function selectTransport(type) {
    transportType = type;
    document.querySelectorAll('.transport-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(type).classList.add('selected');

    const fuelSelection = document.getElementById('fuel-selection');
    const fuelLitersDisplay = document.getElementById('fuel_liters_display');
    const fuelCostDisplay = document.getElementById('fuel_cost_display');

    if (type === 'car' || type === 'motorcycle' || type === 'truck' || type === 'trailer') {
        fuelSelection.classList.remove('hidden-by-transport');
        fuelLitersDisplay.classList.remove('hidden-by-transport');
        fuelCostDisplay.classList.remove('hidden-by-transport');

        if (type === 'truck' || type === 'trailer') {
            document.getElementById('magna').style.display = 'none';
            document.getElementById('premium').style.display = 'none';
            document.getElementById('diesel').style.display = 'block';
            selectFuel('diesel');
        } else {
            document.getElementById('magna').style.display = 'block';
            document.getElementById('premium').style.display = 'block';
            document.getElementById('diesel').style.display = 'block';
        }
    } else {
        fuelSelection.classList.add('hidden-by-transport');
        fuelLitersDisplay.classList.add('hidden-by-transport');
        fuelCostDisplay.classList.add('hidden-by-transport');
    }
    updateRoute();
}

function selectFuel(type) {
    document.querySelectorAll('.fuel-option').forEach(el => el.classList.remove('selected'));
    
    if (type) {
        fuelType = type;
        document.getElementById(type).classList.add('selected');

        if (type === 'magna') fuelPrice = 21.79;
        else if (type === 'premium') fuelPrice = 23.71;
        else if (type === 'diesel') fuelPrice = 23.16;
    } else {
        fuelType = '';
        fuelPrice = 0;
    }
    updateRoute();
}

// --- Funciones Principales ---
function updateRoute() {
    if (!originMarker || !destinationMarker) return;

    fuelEfficiency = parseFloat(document.getElementById('fuel_efficiency').value) || 10;

    if (routeControl) {
        map.removeControl(routeControl);
        routeControl = null;
    }

    routeControl = L.Routing.control({
        waypoints: [originMarker.getLatLng(), destinationMarker.getLatLng()],
        router: L.Routing.osrmv1({serviceUrl: 'https://router.project-osrm.org/route/v1'}),
        createMarker: () => null,
        lineOptions: {styles: [{color: 'blue', opacity: 0.3}]},
        fitSelectedRoutes: true,
        showAlternatives: false
    }).addTo(map);

    routeControl.on('routesfound', function(e) {
        highlightBuildingSegments(e.routes[0]);
        drawBuildingConnections();
        
        const distanceKm = (e.routes[0].summary.totalDistance / 1000).toFixed(2);
        const timeHours = (e.routes[0].summary.totalTime / 3600).toFixed(2);
        
        document.getElementById('distance').value = distanceKm;
        document.getElementById('operating_hours').value = timeHours;
        
        if (fuelType) {
            const fuelLiters = (distanceKm / fuelEfficiency).toFixed(2);
            const fuelCost = (fuelLiters * fuelPrice).toFixed(2);
            document.getElementById('fuel_liters').value = fuelLiters;
            document.getElementById('fuel_cost').value = fuelCost;
        } else {
            document.getElementById('fuel_liters').value = '';
            document.getElementById('fuel_cost').value = '';
        }
    });
}

function clearMarkersAndRoute() {
    [originMarker, destinationMarker].forEach(m => m && map.removeLayer(m));
    originMarker = destinationMarker = null;
    
    if (routeControl) map.removeControl(routeControl);
    if (routeLine) map.removeLayer(routeLine);
    
    buildingLayer.clearLayers();
    buildingConnections.clearLayers();
    
    document.getElementById('search_origin').value = '';
    document.getElementById('search_destination').value = '';
    document.getElementById('distance').value = '';
    document.getElementById('operating_hours').value = '';
    document.getElementById('fuel_liters').value = '';
    document.getElementById('fuel_cost').value = '';
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    selectTransport('car');
    selectFuel('magna');
    
    // Configurar event listeners
    document.getElementById('fuel_efficiency').addEventListener('input', updateRoute);
    document.getElementById('search-route-button').addEventListener('click', searchRouteByNames);
    document.getElementById('clear-markers-button').addEventListener('click', clearMarkersAndRoute);
});