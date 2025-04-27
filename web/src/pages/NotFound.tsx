import { Button } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'

const NotFound = () => {
    const navigate = useNavigate()

    return (
        <div className="page-container" style={{ textAlign: 'center', paddingTop: '100px' }}>
            <h1>404</h1>
            <p>页面不存在</p>
            <Button
                color="primary"
                onClick={() => navigate('/')}
                style={{ marginTop: '20px' }}
            >
                返回首页
            </Button>
        </div>
    )
}

export default NotFound