import React from 'react';
import Main from '../../components/main/Main';
import Sidebar from '../../components/admin/AdminSidebar';
import AddBattleMachineForm from '../../components/battle/AddBattleMachineForm';

const BattleMachinesManagement: React.FC = () => {
    return (
        <div className="admin-dashboard">
            <Sidebar />
            <AddBattleMachineForm />
        </div>
        
        
    );
};

export default BattleMachinesManagement;
