import { Form, useLoaderData, redirect } from "react-router";
import { getAuthenticatedUser } from "~/auth.server";
import { 
    getUsers, addUser, removeUser, 
    getAllMappings, addMapping, removeMapping, 
    isDbEmpty, isUserAllowed 
} from "~/db.server";
import type { Route } from "./+types/db";

export async function loader({ request }: Route.LoaderArgs) {
    const user = await getAuthenticatedUser(request);
    const dbEmpty = isDbEmpty();

    // If DB is not empty, user must be logged in.
    if (!dbEmpty) {
        if (!user) {
            return redirect("/auth/google");
        }
        if (!isUserAllowed(user.email)) {
             return redirect("/auth/google"); 
        }
    }

    const users = getUsers();
    const mappings = getAllMappings();

    return { users, mappings, user, dbEmpty };
}

export async function action({ request }: Route.ActionArgs) {
    const user = await getAuthenticatedUser(request);
    const dbEmpty = isDbEmpty();
    
    if (!dbEmpty && (!user || !isUserAllowed(user.email))) {
        return redirect("/auth/google");
    }

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "addUser") {
        const email = formData.get("email") as string;
        if (email) addUser(email);
    } else if (intent === "removeUser") {
        const id = Number(formData.get("id"));
        if (id) removeUser(id);
    } else if (intent === "addMapping") {
        const userId = Number(formData.get("userId"));
        const urlPath = formData.get("urlPath") as string;
        const directory = formData.get("directory") as string;
        if (userId && urlPath && directory) addMapping(userId, urlPath, directory);
    } else if (intent === "removeMapping") {
        const id = Number(formData.get("id"));
        if (id) removeMapping(id);
    }

    return null;
}

export default function DbAdmin() {
    const { users, mappings, user, dbEmpty } = useLoaderData<typeof loader>();

    return (
        <div className="p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">Database Management</h1>
            
            {dbEmpty && <div className="bg-yellow-100 p-4 mb-4 border border-yellow-300 rounded text-yellow-800">
                Warning: Database is empty. Access is open. Please add a user.
            </div>}

            <div className="mb-4">
                <p>Logged in as: <strong>{user?.email || "Guest"}</strong></p>
                {!user && <Form action="/auth/google" method="post"><button className="text-blue-600 underline">Login with Google</button></Form>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-semibold mb-2">Users</h2>
                    <ul className="mb-4 border rounded divide-y">
                        {users.map(u => (
                            <li key={u.id} className="p-2 flex justify-between items-center">
                                <span>{u.email}</span>
                                <Form method="post" className="inline">
                                    <input type="hidden" name="id" value={u.id} />
                                    <button type="submit" name="intent" value="removeUser" className="text-red-500 hover:underline">Remove</button>
                                </Form>
                            </li>
                        ))}
                    </ul>
                    <Form method="post" className="flex gap-2">
                        <input type="email" name="email" placeholder="Email" required className="border p-1 rounded flex-1" />
                        <button type="submit" name="intent" value="addUser" className="bg-blue-500 text-white px-4 py-1 rounded">Add User</button>
                    </Form>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-2">Mappings</h2>
                    <ul className="mb-4 border rounded divide-y">
                        {mappings.map(m => (
                            <li key={m.id} className="p-2 flex flex-col sm:flex-row justify-between sm:items-center">
                                <div>
                                    <div className="font-bold">{m.url_path}</div>
                                    <div className="text-sm text-gray-600">{m.directory}</div>
                                    <div className="text-xs text-gray-500">User: {m.email}</div>
                                </div>
                                <Form method="post" className="inline">
                                    <input type="hidden" name="id" value={m.id} />
                                    <button type="submit" name="intent" value="removeMapping" className="text-red-500 hover:underline">Remove</button>
                                </Form>
                            </li>
                        ))}
                    </ul>
                    <Form method="post" className="flex flex-col gap-2 p-4 border rounded bg-gray-50">
                        <select name="userId" required className="border p-1 rounded">
                            <option value="">Select User</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                        </select>
                        <input type="text" name="urlPath" placeholder="URL Path (e.g. /photos)" required className="border p-1 rounded" />
                        <input type="text" name="directory" placeholder="Directory Absolute Path" required className="border p-1 rounded" />
                        <button type="submit" name="intent" value="addMapping" className="bg-green-500 text-white px-4 py-1 rounded">Add Mapping</button>
                    </Form>
                </div>
            </div>
        </div>
    );
}