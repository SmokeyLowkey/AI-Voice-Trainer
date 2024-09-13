import {auth, currentUser} from '@clerk/nextjs/server';
import Home from '../page';

export default async function DashboardPage(){
    const {userId} = auth();
    const user = await currentUser();
    
    if(!userId || !user) {
        return <div>You are not logged in!</div>
    }

    return(
        <div className="h-screen min-h-screen">
         <Home/>
        </div>
       
    )
}