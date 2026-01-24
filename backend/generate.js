let start = 10001;
let end = 10500;

console.log("INSERT INTO proxies (proxy_url, label) VALUES");

for (let port = start; port <= end; port++) {
    const comma = port === end ? ";" : ",";
    console.log(
        `('http://spalkpghlq:h6bbqAiY_MkH85lxh0@gate.decodo.com:${port}', 'Decodo ${port}')${comma}`
    );
}
