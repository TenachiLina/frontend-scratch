import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-regular-svg-icons";
import Spline from '@splinetool/react-spline';


export default function HomeContent(){
    return(
        <main className="flex lg:mt-20 flex-col lg:flex-row items-center justify-between min-h-[calc(90vh-6rem)]">
            <div style={{width:"700px"}}> 
                <div className="gradient-pill">
                    <FontAwesomeIcon icon={faClock} className="icon" />
                    <span className="text">Nexo InOuty</span>
                </div>
                <h1 className="title1"><span>S</span>mart <span>S</span>hifts <span>H</span>appy <span>T</span>eam</h1>
                <h3 className="title2">
                   Where you can easily monitor your employees’ clock-ins and clock-outs, 
                   store attendance securely, and calculate payroll automatically.
                   You save time, reduce errors, and get a clear overview of your team’s activity—all in one simple tool.
                </h3>
            </div>       
            <div style={{width:"470px", height:"600px"}}> 
             <Spline scene="https://prod.spline.design/ee39AWaffnQRgf0Y/scene.splinecode" />
            </div> 
        </main>

    )
}