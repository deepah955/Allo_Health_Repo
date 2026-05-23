Allo Inventory Warehouse Reservation System


A full application that solves the problem of two people trying to buy the exact same item at the same time. It locks the item in the database so only one person can successfully buy it.



1. Live Demo

You can deploy this project to Netlify and check your live website link there.



2. Local Setup Steps

Here is what you need to run this on your own computer. You need Node installed and a database like Supabase.

1. Download the code from your repository.
2. Open the folder called AlloHealthProject.
3. Run the install command to get all required packages.
4. Copy the environment example file and create your own environment file.
5. Put your database connection link inside the new environment file.
6. Push the database structure by running the database push command.
7. Fill the database with sample items by running the database seed command.
8. Start the server by running the development command.
9. Open your browser and go to localhost port 3000.



3. How the Reservation System Works

When someone tries to buy an item, taking their payment can take a few minutes. If we remove the item from stock too early, people who leave without paying will make items look sold out. If we remove the item too late, two people might pay for the exact same physical item.

Our solution is to lock the stock in the database the moment someone clicks reserve. The database processes these requests one by one. If ten people click reserve at the exact same time for the very last item, the database will give it to the first person and tell the other nine people that the item is sold out.



4. Expiry Mechanism

Reservations only last for a limited time so items are not locked forever.

1. A background task runs every 5 minutes to find expired reservations and put the items back in stock.
2. Whenever anyone views the products page, the system also checks for expired reservations and cleans them up.
3. When someone tries to finalize their purchase, the system checks the time one last time to make sure their reservation has not expired.



5. Safety Features

If a payment fails and the system tries to confirm the purchase a second time, we use a unique key to remember that we already handled this request. This prevents the system from accidentally removing the stock twice.



6. Application Programming Interface Reference

Here are the available commands you can send to the server.

1. Get products to list products with available stock.
2. Get warehouses to list all warehouses.
3. Post reservations to lock an item.
4. Post reservations confirm to finalize the purchase.
5. Post reservations release to cancel the purchase early.
6. Get cron cleanup to remove all expired items.



7. Concurrency Test

You can test how the system handles many requests at once. While the server is running, you can run the test concurrency script. It will send ten requests at the exact same time for the last available item. It will verify that exactly one request succeeds and nine requests fail.



8. Deploying to Netlify

1. Push your code to GitHub.
2. Import the code in Netlify.
3. Set your database connection link in the environment variables.
4. Deploy the project.
5. In your GitHub repository settings add a secret called PRODUCTION_URL with your live Netlify link to run the cleanup task every 5 minutes.



9. Future Improvements

What works well is that the database safely handles multiple requests at once without extra tools. In the future we could add user accounts to track who is reserving items. We could also add exact prices at the time of reservation and a dashboard to manage all warehouse stock.
