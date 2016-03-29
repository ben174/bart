var Bart = function() {
    return {
        stations: null,
        location: null,
        closestStation: null,
        getCurrentPosition: new Promise(function(resolve, reject) {
            navigator.geolocation.getCurrentPosition(function(pos) {
                console.log("Got position: " + pos);
                resolve(pos);
            });
        }),
        getStationPositions: new Promise(function(resolve, reject) {
            $.ajax({
                type: "GET",
                url: "http://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V",
                dataType: "xml",
                success: function(xml) {
                    var stations = $(xml).find("station").map(function(i, el) {
                        return {
                            name: $(el).find("name").text(),
                            abbr: $(el).find("abbr").text(),
                            lat: $(el).find("gtfs_latitude").text(),
                            lon: $(el).find("gtfs_longitude").text(),
                        }
                    }).get();
                    console.log(stations);
                    resolve(stations);
                },
                error: function(err) {
                    console.log(err);
                    reject(err);
                }
           });
        }),
        init: function() {
            Promise.all([this.getCurrentPosition, this.getStationPositions]).then(function(vals) {
                bart.location = vals[0];
                bart.stations = vals[1];
                bart.getClosestStation();
                bart.getClosestStationTimes();
            });
        },
        getClosestStation: function() {
            var closest = null;
            $(this.stations).each(function(i, el) {
                el.distance = bart.getDistanceFromLatLonInKm(bart.location.coords.latitude,
                    bart.location.coords.longitude,
                    el.lat,
                    el.lon)
                if(closest === null || el.distance < closest.distance) {
                    closest = el;
                }
            });
            this.closestStation = closest;
            $("#station").text(closest.name);
            return closest;
        },
        getClosestStationTimes: function(data) {
            this.getStationTimes(bart.closestStation.abbr);
        },
        getStationTimes: function(abbr) {
            var url = "http://api.bart.gov/api/etd.aspx?cmd=etd&orig=" + abbr + "&key=MW9S-E7SL-26DU-VV8V";
            $.ajax({
                type: "GET",
                url: url,
                dataType: "xml",
                success: function(xml) {
                    $(xml).find("etd").each(bart.parseDestination);
                }
           });
        },
        parseDestination: function(index, elem) {
            var destination = $(elem).find("destination").text();
            var times = $(elem).find("estimate > minutes").map(function(i, el) {
                return $(el).text();
            }).get();
            var li = $("<li>");
            var stationSpan = $("<span class=\"destStation\">").text(destination);
            var timesSpan = $("<span class=\"destTimes\">").text(times.join(', '));
            $(li).append(stationSpan);
            $(li).append(timesSpan);

            $("#departures").append(li);

            console.log("Destination: " + destination + " - Departure times: " + times.join(', '));
        },
        getDistanceFromLatLonInKm: function(lat1,lon1,lat2,lon2) {
            var R = 6371; // Radius of the earth in km
            var dLat = this.deg2rad(lat2-lat1);  // deg2rad below
            var dLon = this.deg2rad(lon2-lon1);
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
                    Math.sin(dLon/2) * Math.sin(dLon/2) ;
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            var d = R * c; // Distance in km
            return d;
        },
        deg2rad: function(deg) {
            return deg * (Math.PI/180)
        }
    }
};

$(function() {
    bart = new Bart();
    bart.init();
});
