# Twin Concrete Company website: deploy guide

Folder layout (keep it exactly like this):

    public/index.html              the website and admin panel
    netlify/functions/api.mjs      login, prices and photo storage
    package.json                   installs the photo storage package
    netlify.toml                   Netlify settings

## Deploy with GitHub (recommended)
1. Create a private repository on GitHub and upload all of these files, keeping the folders.
2. On Netlify choose Add new site, Import an existing project, GitHub, then pick the repository. Leave the build command empty and click Deploy.
3. In Netlify open Site configuration, then Environment variables, and add:
   ADMIN_USER = TWINCONCRETECO
   ADMIN_PASSWORD_BASE = Twinconcete@
4. Open Deploys, then Trigger deploy, then Deploy site, so the new variables take effect.
5. Visit your-site.netlify.app/admin. Username: TWINCONCRETECO. Password: Twinconcete@ followed by the current year, for example Twinconcete@2026.

## Deploy with the Netlify command line
    npm install -g netlify-cli
    npm install
    netlify login
    netlify init
    netlify env:set ADMIN_USER TWINCONCRETECO
    netlify env:set ADMIN_PASSWORD_BASE "Twinconcete@"
    netlify deploy --prod

Do not use drag and drop: it does not reliably install the package the photo storage needs.

## If something goes wrong
- Admin shows "not set on Netlify": add the two variables, then redeploy.
- Admin shows a preview banner on the live site: the function did not deploy. Check the Functions tab in Netlify.
- The password stops working on 1 January: use the base plus the new year.
