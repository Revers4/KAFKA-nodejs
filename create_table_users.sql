CREATE TABLE anime(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    year INT NOT NULL,
    description VARCHAR(1500) NOT NULL,
    poster VARCHAR(1000),
    screenshot VARCHAR(1000)
);