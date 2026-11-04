# Cigarette price list

Static shop page plus a small Node server (no dependencies, Node 18+) with an admin page to edit
product names, prices, categories and photos.

## Run locally
Double-click `start.bat`, or:

    node server.js        # http://localhost:8080  (admin: /admin)

## Environment variables
| name | meaning |
| --- | --- |
| `PORT` | port to listen on (default 8080) |
| `HOST` | bind address (default `127.0.0.1`; `0.0.0.0` when `NODE_ENV=production`) |
| `ADMIN_USER` | admin login name (default `admin`) |
| `ADMIN_PASSWORD` | admin password. **Set this in production**; unset means anyone can edit. |

For local use put the login in `admin.local.bat` (git-ignored):

    set ADMIN_USER=admin
    set ADMIN_PASSWORD=change-me

## Data
Products live in `data/products.json`, photos in `images/`. On a host with a temporary disk,
mount a persistent volume for both, otherwise admin edits are lost on redeploy.
